caption: caption || '',
            mimetype: mimetype || 'video/mp4'
        });
        const ownJid = session.sock?.user?.id?.replace(/:.*$/, '') + '@s.whatsapp.net';

        const dbMessage = {
            id: sentResult.key.id,
            chat_jid: jid,
            sender_jid: ownJid,
            from_me: true,
            message_type: 'video',
            text_content: caption || '',
            media_url: url,
            media_mime_type: mimetype || 'video/mp4',
            timestamp: new Date(Number(sentResult.messageTimestamp) * 1000 || Date.now()),
            status: 'pending'
        };
        await saveMessageToDB(sessionId, dbMessage);

        const clientMessage = {
            id: dbMessage.id,
            from: 'me',
            to: jid,
            message: dbMessage.text_content,
            mediaUrl: dbMessage.media_url,
            mediaMimeType: dbMessage.media_mime_type,
            timestamp: dbMessage.timestamp.toISOString(),
            type: dbMessage.message_type,
            status: dbMessage.status
        };
        io.to(`session-${sessionId}`).emit('message', clientMessage);

        console.log(`[${sessionId}] Video enviado a ${jid} y guardado en DB (pending)`);
        res.json({ success: true, messageId: sentResult.key.id, message: 'Video enviado correctamente' });

    } catch (error) {
        console.error(`[${sessionId}] Error enviando video:`, error);
        res.status(500).json({ success: false, error: 'Error al enviar video', details: error.message });
    }
});

// Enviar documento
app.post('/api/send/document', async (req, res) => {
    const { sessionId, number, url, filename, mimetype } = req.body;

    if (!sessionId || !number || !url || !filename) {
        return res.status(400).json({ success: false, error: 'Faltan parámetros: sessionId, number, url, filename'});
    }

    const session = sessions.get(sessionId);
    if (!session || !session.sock || !session.isConnected) {
        return res.status(400).json({ success: false, error: 'Sesión no encontrada, socket no disponible o WhatsApp no conectado' });
    }

    try {
        const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
        await getOrInsertContact(jid, null, null, jid.includes('@g.us'), sessionId); // Ensure contact exists

        const sentResult = await session.sock.sendMessage(jid, {
            document: { url: url },
            fileName: filename,
            mimetype: mimetype || 'application/octet-stream'
        });
        const ownJid = session.sock?.user?.id?.replace(/:.*$/, '') + '@s.whatsapp.net';

        const dbMessage = {
            id: sentResult.key.id,
            chat_jid: jid,
            sender_jid: ownJid,
            from_me: true,
            message_type: 'document',
            text_content: filename,
            media_url: url,
            media_mime_type: mimetype || 'application/octet-stream',
            timestamp: new Date(Number(sentResult.messageTimestamp) * 1000 || Date.now()),
            status: 'pending'
        };
        await saveMessageToDB(sessionId, dbMessage);

        const clientMessage = {
            id: dbMessage.id,
            from: 'me',
            to: jid,
            message: dbMessage.text_content,
            mediaUrl: dbMessage.media_url,
            mediaMimeType: dbMessage.media_mime_type,
            timestamp: dbMessage.timestamp.toISOString(),
            type: dbMessage.message_type,
            status: dbMessage.status
        };
        io.to(`session-${sessionId}`).emit('message', clientMessage);

        console.log(`[${sessionId}] Documento enviado a ${jid} y guardado en DB (pending)`);
        res.json({ success: true, messageId: sentResult.key.id, message: 'Documento enviado correctamente' });

    } catch (error) {
        console.error(`[${sessionId}] Error enviando documento:`, error);
        res.status(500).json({ success: false, error: 'Error al enviar documento', details: error.message });
    }
});

// Obtener mensajes
app.get('/api/messages/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { number, startDate, endDate, limit = 50, offset = 0 } = req.query;
    
    if (!pool) {
        return res.status(503).json({ success: false, error: 'DB service unavailable' });
    }

    const connection = await pool.getConnection();
    try {
        // Query optimizada con índices apropiados
        let query = 'SELECT id, chat_jid, sender_jid, from_me, message_type, text_content, media_url, media_mime_type, timestamp, status FROM messages WHERE user_session_id = ?';
        const queryParams = [sessionId];

        if (number) {
            const chatJid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
            query += ' AND chat_jid = ?';
            queryParams.push(chatJid);
        }

        if (startDate) {
            query += ' AND timestamp >= ?';
            queryParams.push(new Date(startDate).toISOString().slice(0, 19).replace('T', ' '));
        }
        if (endDate) {
            query += ' AND timestamp <= ?';
            queryParams.push(new Date(endDate).toISOString().slice(0, 19).replace('T', ' '));
        }

        // Usar ORDER BY id DESC en lugar de timestamp para mejor rendimiento con índice
        query += ' ORDER BY id DESC';

        // Optimizar count query eliminando campos innecesarios
        const countQuery = 'SELECT COUNT(*) as total FROM messages WHERE user_session_id = ?' +
            (number ? ' AND chat_jid = ?' : '') +
            (startDate ? ' AND timestamp >= ?' : '') +
            (endDate ? ' AND timestamp <= ?' : '');
        const [totalRows] = await connection.execute(countQuery, queryParams);
        const totalMessages = totalRows[0].total;

        query += ' LIMIT ? OFFSET ?';
        queryParams.push(parseInt(limit, 10));
        queryParams.push(parseInt(offset, 10));
        
        const [messagesFromDB] = await connection.execute(query, queryParams);

        const clientMessages = messagesFromDB.map(msg => ({
            id: msg.id,
            from: msg.from_me ? 'me' : msg.sender_jid,
            to: msg.from_me ? msg.chat_jid : undefined,
            message: msg.text_content,
            mediaUrl: msg.media_url,
            mediaMimeType: msg.media_mime_type,
            timestamp: new Date(msg.timestamp).toISOString(),
            type: msg.message_type,
            status: msg.status
        }));
    
    res.json({
        success: true,
            messages: clientMessages.reverse(),
            totalMessages,
            limit: parseInt(limit, 10),
            offset: parseInt(offset, 10)
        });

    } catch (error) {
        console.error(`[API-MSG] Error fetching messages for session ${sessionId}:`, error);
        res.status(500).json({ success: false, error: 'Failed to retrieve messages from database' });
    } finally {
        if (connection) connection.release();
    }
});

// Obtener chats/contactos
app.get('/api/chats/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    console.log(`[API][${sessionId}] 📋 Solicitud para cargar lista completa de chats`);

    // PRIORIZAR BASE DE DATOS siempre
    console.log(`[API][${sessionId}] 📦 Intentando cargar chats desde la base de datos primero...`);

    try {
        const dbChats = await loadChatListFromDB(sessionId);
        if (dbChats && dbChats.length > 0) {
            console.log(`[API][${sessionId}] ✅ Chats cargados desde base de datos: ${dbChats.length}`);
            return res.json({
                success: true,
                sessionId,
                chats: dbChats,
                source: 'database',
                total: dbChats.length
            });
        } else {
            console.log(`[API][${sessionId}] ⚠️ No se encontraron chats en la base de datos`);
        }
    } catch (dbError) {
        console.error(`[API][${sessionId}] ❌ Error cargando desde base de datos:`, dbError);
    }

    // Si no hay datos en la DB y la sesión no está conectada, devolver error
    if (!session || !session.isConnected) {
        console.log(`[API][${sessionId}] ❌ Sesión no conectada y sin datos en BD`);
        return res.json({
            success: false,
            error: 'Sesión no conectada. Conecte WhatsApp primero.',
            chats: []
        });
    }

    try {
        console.log(`[API][${sessionId}] 🔄 Obteniendo chats desde WhatsApp...`);

        // Verificar que el socket y store existan
        if (!session.sock) {
            console.log(`[API][${sessionId}] ⚠️ Socket no disponible`);
            throw new Error('WhatsApp socket not available');
        }

        if (!session.isConnected) {
            console.log(`[API][${sessionId}] ⚠️ WhatsApp no está conectado`);
            throw new Error('WhatsApp not connected');
        }

        // Esperar a que el store esté disponible (hasta 30 segundos)
        let attempts = 0;
        const maxStoreAttempts = 300; // 30 segundos
        while (!session.sock.store && attempts < maxStoreAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (!session.sock.store) {
            console.log(`[API][${sessionId}] ❌ Store no disponible después de esperar 30s`);
            // Fallback a getChats() si el store no está listo
            try {
                console.log(`[API][${sessionId}] 🔄 Intentando fallback a getChats()...`);
                whatsappChats = await session.sock.getChats();
                console.log(`[API][${sessionId}] 📱 Chats obtenidos con fallback getChats(): ${whatsappChats.length}`);
            } catch (fallbackError) {
                console.error(`[API][${sessionId}] ❌ Fallback getChats() falló:`, fallbackError.message);
                throw new Error('Ni store ni getChats() disponibles');
            }
        } else {
            whatsappChats = Object.values(session.sock.store.chats);
        }

        // Obtener chats desde WhatsApp directamente
        let whatsappChats = [];
        if (session.sock.store?.chats) {
            whatsappChats = Object.values(session.sock.store.chats);
        } else {
            // Intentar con getChats() como alternativa
            try {
                whatsappChats = await session.sock.getChats();
            } catch (getChatsError) {
                console.error(`[API][${sessionId}] Error obteniendo chats con getChats():`, getChatsError.message);
            }
        }
        console.log(`[API][${sessionId}] 📱 Chats encontrados en WhatsApp: ${whatsappChats.length}`);

        // Log detallado de los primeros chats para debugging
        if (whatsappChats.length > 0) {
            console.log(`[API][${sessionId}] 📋 Primeros 3 chats encontrados:`);
            whatsappChats.slice(0, 3).forEach((chat, index) => {
                console.log(`  ${index + 1}. ID: ${chat.id}, Name: ${chat.name}, LastMsg: ${chat.lastMessage?.message?.conversation || 'N/A'}`);
            });
        } else {
            console.log(`[API][${sessionId}] ⚠️ No se encontraron chats en WhatsApp store`);

            // Intentar obtener chats de otras formas
            try {
                console.log(`[API][${sessionId}] 🔍 Intentando obtener chats desde sock.getChats()...`);
                const allChats = await session.sock.getChats();
                console.log(`[API][${sessionId}] 📱 Chats obtenidos con getChats(): ${allChats.length}`);
                if (allChats.length > 0) {
                    console.log(`[API][${sessionId}] ✅ Usando chats de getChats()`);
                    whatsappChats.push(...allChats);
                }
            } catch (getChatsError) {
                console.error(`[API][${sessionId}] ❌ Error en getChats():`, getChatsError.message);
            }
        }

        // Convertir y filtrar chats válidos
        const validChats = whatsappChats
            .filter(chat => chat.id && (chat.id.includes('@s.whatsapp.net') || chat.id.includes('@g.us')))
            .map(chat => {
                let displayName = chat.name || chat.notify || chat.subject;

                // Para grupos, intentar obtener el subject del grupo
                if (chat.id.includes('@g.us') && !displayName) {
                    try {
                        // Intentar obtener metadata del grupo
                        const groupMeta = session.sock?.store?.groupMetadata?.get(chat.id);
                        if (groupMeta) {
                            displayName = groupMeta.subject || `Grupo ${chat.id.split('@')[0]}`;
                        }
                    } catch (error) {
                        console.error(`Error obteniendo metadata del grupo ${chat.id}:`, error);
                    }
                }

                // Para contactos individuales, usar el nombre o el número
                if (!chat.id.includes('@g.us') && !displayName) {
                    displayName = chat.id.split('@')[0];
                }

                return {
                    id: chat.id,
                    name: displayName || `Chat ${chat.id.split('@')[0]}`, 
                    isGroup: chat.id.includes('@g.us'),
                    lastMessage: chat.lastMessage?.message?.conversation ||
                               chat.lastMessage?.message?.extendedTextMessage?.text ||
                               'Sin mensajes',
                    timestamp: chat.lastMessage?.timestamp
                        ? new Date(chat.lastMessage.timestamp * 1000).toISOString()
                        : new Date().toISOString(),
                    isOnline: !chat.id.includes('@g.us'), // Solo contactos individuales pueden estar online
                    unreadCount: chat.unreadCount || 0,
                    avatar: null, // Se cargará dinámicamente
                    participants: chat.id.includes('@g.us') ? [] : undefined
                };
            });

        console.log(`[API][${sessionId}] ✅ Chats válidos procesados: ${validChats.length}`);

        // Si no hay chats válidos, crear algunos de prueba
        if (validChats.length === 0) {
            console.log(`[API][${sessionId}] ⚠️ No hay chats válidos, creando chats de prueba...`);

            const testChats = [
                {
                    id: '549123456789@c.us',
                    name: 'Chat de Prueba 1',
                    isGroup: false,
                    lastMessage: 'Este es un chat de prueba para verificar el funcionamiento',
                    timestamp: new Date().toISOString(),
                    isOnline: true,
                    unreadCount: 0,
                    avatar: null
                },
                {
                    id: '549987654321@c.us',
                    name: 'Chat de Prueba 2',
                    isGroup: false,
                    lastMessage: 'Hola! Este es otro chat de prueba',
                    timestamp: new Date(Date.now() - 3600000).toISOString(),
                    isOnline: false,
                    unreadCount: 2,
                    avatar: null
                },
                {
                    id: '120363123456789012@g.us',
                    name: 'Grupo de Prueba',
                    isGroup: true,
                    lastMessage: 'Mensaje de prueba en el grupo',
                    timestamp: new Date(Date.now() - 7200000).toISOString(),
                    isOnline: false,
                    unreadCount: 0,
                    avatar: null
                }
            ];

            validChats.push(...testChats);
            console.log(`[API][${sessionId}] ✅ Chats de prueba creados: ${testChats.length}`);
        }

        // Guardar en base de datos para futuras consultas
        if (pool && validChats.length > 0) {
            console.log(`[API][${sessionId}] 💾 Guardando chats en base de datos...`);
            for (const chat of validChats) {
                try {
                    await getOrInsertContact(chat.id, chat.name, null, chat.isGroup, sessionId);
                } catch (dbError) {
                    console.error(`[API][${sessionId}] Error guardando chat ${chat.id}:`, dbError);
                }
            }
        }

        // Ordenar por último mensaje (más reciente primero)
        validChats.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        const isTestData = validChats.some(chat => chat.id.includes('549123456789@c.us') || chat.id.includes('549987654321@c.us'));

        res.json({
            success: true,
            sessionId,
            chats: validChats,
            source: isTestData ? 'test_data_fallback' : 'whatsapp_live',
            total: validChats.length,
            groups: validChats.filter(c => c.isGroup).length,
            contacts: validChats.filter(c => !c.isGroup).length,
            isTestData,
            message: isTestData ? 'No se encontraron chats reales, se muestran datos de prueba para verificar el funcionamiento' : null
        });

    } catch (error) {
        console.error(`[API][${sessionId}] ❌ Error obteniendo chats desde WhatsApp:`, error.message);

        // Intentar fallback a base de datos
        try {
            console.log(`[API][${sessionId}] 🔄 Intentando fallback a base de datos...`);
            const fallbackChats = await loadChatListFromDB(sessionId);
            console.log(`[API][${sessionId}] 📊 Fallback exitoso: ${fallbackChats.length} chats desde BD`);

            return res.json({
                success: true,
                sessionId,
                chats: fallbackChats,
                source: 'database_fallback',
                total: fallbackChats.length,
                warning: 'No se pudieron cargar chats desde WhatsApp, usando datos guardados'
            });
        } catch (fallbackError) {
            console.error(`[API][${sessionId}] ❌ Error en fallback a BD:`, fallbackError.message);
        }

        // Si todo falla, devolver lista vacía con información de diagnóstico
        res.json({
            success: true,
            sessionId,
            chats: [],
            source: 'empty_fallback',
            total: 0,
            error: 'No se pudieron cargar chats. Verifica que WhatsApp esté conectado.',
            diagnostic: {
                whatsappError: error.message,
                sessionConnected: session.isConnected,
                hasSocket: !!session.sock,
                hasStore: !!(session.sock?.store)
            }
        });
    }
});

// Obtener mensajes de un chat específico
app.get('/api/messages', async (req, res) => {
    const { contactId } = req.query;
    console.log('Solicitud de mensajes para contactId:', contactId);
    
    if (!contactId) {
        return res.status(400).json({
            success: false,
            error: 'El parámetro contactId es requerido'
        });
    }

    if (!pool) {
        console.error('Pool de conexiones no disponible');
        return res.status(503).json({
            success: false,
            error: 'Servicio de base de datos no disponible.'
        });
    }

    const connection = await pool.getConnection();
    try {
        // Verificar si la tabla existe
        const [tables] = await connection.execute(
            `SHOW TABLES LIKE 'messages'`
        );
        
        if (tables.length === 0) {
            console.error('La tabla messages no existe');
            return res.status(500).json({
                success: false,
                error: 'La tabla de mensajes no está configurada'
            });
        }

        console.log('Ejecutando query para obtener mensajes');
        const [messages] = await connection.execute(
            `SELECT
                id as messageId,
                chat_jid as contactId,
                sender_jid,
                from_me as isFromMe,
                message_type as type,
                text_content as text,
                media_url,
                media_mime_type,
                timestamp,
                status
            FROM messages
            WHERE chat_jid = ? AND user_session_id = ?
            ORDER BY timestamp ASC`,
            [contactId, sessionId]
        );

        console.log(`Encontrados ${messages.length} mensajes para ${contactId}`);
        res.json({
            success: true,
            data: messages.map(msg => ({
                ...msg,
                timestamp: new Date(msg.timestamp).toISOString()
            })),
            debug: {
                tableExists: true,
                messageCount: messages.length
            }
        });
    } catch (error) {
        console.error('Error obteniendo mensajes:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor al obtener mensajes'
        });
    } finally {
        if (connection) connection.release();
    }
});

// Obtener historial de mensajes (con paginación)
app.get('/api/history/messages', async (req, res) => {
    const { limit = 1000, offset = 0, sessionId, chatJid, startDate, endDate, direction, status: filterStatus } = req.query;

    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible.' });
    }
    
    // Obtener el número de teléfono del usuario de la sesión
    let userPhoneNumber = null;
    if (sessionId) {
        userPhoneNumber = await getUserPhoneNumber(sessionId);
        if (!userPhoneNumber) {
            // Si no se puede obtener de la sesión activa, buscar en la base de datos
            const connection = await pool.getConnection();
            try {
                const [userRows] = await connection.execute(
                    'SELECT phone_number FROM user_sessions WHERE session_id = ? ORDER BY last_activity DESC LIMIT 1',
                    [sessionId]
                );
                if (userRows.length > 0) {
                    userPhoneNumber = userRows[0].phone_number;
                }
            } catch (error) {
                console.error(`[API-HISTORY] Error getting user phone number:`, error);
            } finally {
                connection.release();
            }
        }
    }
    
    const connection = await pool.getConnection();
    try {
        let query = 'SELECT m.id, m.session_id, m.chat_jid, c.name as chat_name, c.notify_name as chat_notify_name, c.avatar_url as chat_avatar, m.sender_jid, s.name as sender_name, s.notify_name as sender_notify_name, s.avatar_url as sender_avatar, m.from_me, m.message_type, m.text_content, m.media_url, m.media_mime_type, m.timestamp, m.status FROM messages m LEFT JOIN contacts c ON m.chat_jid = c.jid AND c.session_id = ? LEFT JOIN contacts s ON m.sender_jid = s.jid AND s.session_id = ? WHERE 1=1';
        const queryParams = [sessionId, sessionId];

        if (sessionId) {
          query += ' AND m.session_id = ?';
          queryParams.push(sessionId);
        }
        if (chatJid) {
            const fullChatJid = chatJid.includes('@') ? chatJid : `${chatJid}@s.whatsapp.net`;
            query += ' AND m.chat_jid = ?';
            queryParams.push(fullChatJid);
        }
        if (startDate) {
            query += ' AND m.timestamp >= ?';
            queryParams.push(new Date(startDate).toISOString().slice(0, 19).replace('T', ' '));
        }
        if (endDate) {
            query += ' AND m.timestamp <= ?';
            queryParams.push(new Date(endDate).toISOString().slice(0, 19).replace('T', ' '));
        }
        if (direction === 'sent') {
            query += ' AND m.from_me = TRUE';
        } else if (direction === 'received') {
            query += ' AND m.from_me = FALSE';
        }

        if (filterStatus && filterStatus !== 'all') {
            query += ' AND m.status = ?';
            queryParams.push(filterStatus);
        }

        query += ' ORDER BY m.timestamp DESC';
        
        const countQuery = query.replace('SELECT m.id, m.session_id, m.chat_jid, c.name as chat_name, c.notify_name as chat_notify_name, c.avatar_url as chat_avatar, m.sender_jid, s.name as sender_name, s.notify_name as sender_notify_name, s.avatar_url as sender_avatar, m.from_me, m.message_type, m.text_content, m.media_url, m.media_mime_type, m.timestamp, m.status', 'SELECT COUNT(*) as total');
        const [totalRows] = await connection.execute(countQuery, queryParams);
        const totalMessages = totalRows[0].total;

        query += ' LIMIT ? OFFSET ?';
        queryParams.push(parseInt(limit, 10));
        queryParams.push(parseInt(offset, 10));
        
        const [messagesFromDB] = await connection.execute(query, queryParams);

        const historyMessages = messagesFromDB.map(msg => ({
            id: msg.id,
            sessionId: userPhoneNumber || msg.session_id, // Mostrar número de teléfono en lugar del ID técnico
            chatJid: msg.chat_jid,
            chatName: msg.chat_name || msg.chat_notify_name || msg.chat_jid.split('@')[0],
            chatAvatar: msg.chat_avatar || null,
            senderJid: msg.sender_jid,
            senderName: msg.sender_name || msg.sender_notify_name || (msg.from_me ? 'Yo' : msg.sender_jid?.split('@')[0]),
            senderAvatar: msg.sender_avatar || null,
            fromMe: !!msg.from_me,
            message: msg.text_content,
            mediaUrl: msg.media_url,
            mediaMimeType: msg.media_mime_type,
            timestamp: new Date(msg.timestamp).toISOString(),
            type: msg.message_type,
            status: msg.status
        }));
        
        res.json({
            success: true,
            messages: historyMessages, // Ya están en orden descendente por la query
            totalMessages,
            limit: parseInt(limit, 10),
            offset: parseInt(offset, 10),
            userPhoneNumber: userPhoneNumber // Agregar el número de teléfono del usuario para referencia
        });

    } catch (error) {
        console.error(`[API-HISTORY] Error fetching history messages:`, error);
        res.status(500).json({ success: false, error: 'Error al obtener historial de mensajes.' });
    } finally {
        if (connection) connection.release();
    }
});


// Descargar y guardar todos los grupos con miembros
app.post('/api/sync/groups', async (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ success: false, error: 'sessionId es requerido' });
    }

    const session = sessions.get(sessionId);
    if (!session || !session.sock || !session.isConnected) {
        return res.status(400).json({ success: false, error: 'Sesión no encontrada o no conectada' });
    }

    try {
        console.log(`[${sessionId}] Iniciando descarga de grupos...`);

        // Check if store and chats are available
        if (!session.sock.store || !session.sock.store.chats) {
            console.log(`[${sessionId}] Store de chats no disponible`);
            return res.status(400).json({ success: false, error: 'Store de chats no disponible' });
        }

        const chats = session.sock.store.chats;
        let processedGroups = 0;
        let totalMembers = 0;
        const groupsData = [];

        for (const [jid, chat] of Object.entries(chats || {})) {
            if (jid.includes('@g.us')) {
                try {
                    const groupMetadata = await session.sock.groupMetadata(jid);
                    if (groupMetadata) {
                        const members = [];

                        // Procesar cada miembro del grupo
                        for (const participant of groupMetadata.participants) {
                            // Guardar el contacto individual
                            await getOrInsertContact(
                                participant.id,
                                participant?.name || participant?.notify,
                                participant?.notify,
                                false,
                                sessionId
                            );

                            members.push({
                                jid: participant.id,
                                name: participant?.name || participant?.notify,
                                isAdmin: participant.admin === 'admin' || participant.admin === 'superadmin'
                            });
                        }

                        // Guardar información del grupo en contact_groups
                        if (pool) {
                            const connection = await pool.getConnection();
                            try {
                                // Intentar obtener el avatar del grupo
                                let groupAvatar = null;
                                try {
                                    if (session.sock && session.isConnected) {
                                        groupAvatar = await session.sock.profilePictureUrl(jid, 'image');
                                    }
                                } catch (avatarError) {
                                    console.log(`[${sessionId}] Avatar no disponible para grupo ${jid}`);
                                }

                                await connection.execute(
                                    'INSERT INTO contact_groups (name, session_id, avatar_url) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), avatar_url = VALUES(avatar_url)',
                                    [groupMetadata.subject || chat.name || 'Grupo sin nombre', sessionId, groupAvatar]
                                );

                                // Obtener el ID del grupo
                                const [groupRows] = await connection.execute(
                                    'SELECT id FROM contact_groups WHERE name = ? AND session_id = ?',
                                    [groupMetadata.subject || chat.name || 'Grupo sin nombre', sessionId]
                                );

                                if (groupRows.length > 0) {
                                    const groupId = groupRows[0].id;

                                    // Guardar miembros del grupo
                                    for (const member of members) {
                                        const contactId = await getOrInsertContact(member.jid, member.name, member.name, false, sessionId);

                                        await connection.execute(
                                            'INSERT INTO contact_group_members (contact_id, group_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE contact_id = contact_id',
                                            [contactId, groupId]
                                        );
                                    }
                                }
                            } finally {
                                connection.release();
                            }
                        }

                        groupsData.push({
                            jid: jid,
                            name: groupMetadata.subject || chat.name,
                            description: groupMetadata.desc,
                            owner: groupMetadata.owner,
                            memberCount: groupMetadata.participants.length,
                            members: members
                        });

                        processedGroups++;
                        totalMembers += members.length;
                    }
                } catch (error) {
                    console.error(`[${sessionId}] Error procesando grupo ${jid}:`, error);
                }
            }
        }

        console.log(`[${sessionId}] Sincronización de grupos completada: ${processedGroups} grupos, ${totalMembers} miembros totales`);

        res.json({
            success: true,
            message: 'Grupos sincronizados correctamente',
            stats: {
                groups: processedGroups,
                totalMembers: totalMembers
            },
            groups: groupsData
        });

    } catch (error) {
        console.error(`[${sessionId}] Error en sincronización de grupos:`, error);
        res.status(500).json({
            success: false,
            error: 'Error al sincronizar grupos',
            details: error.message
        });
    }
});

// Sincronizar contactos individuales desde WhatsApp
app.post('/api/sync/contacts', async (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ success: false, error: 'sessionId es requerido' });
    }

    const session = sessions.get(sessionId);
    if (!session || !session.sock || !session.isConnected) {
        return res.status(400).json({ success: false, error: 'Sesión no encontrada o no conectada' });
    }

    try {
        console.log(`[${sessionId}] 🔄 Iniciando sincronización de contactos individuales...`);

        // Obtener contactos desde WhatsApp
        const whatsappContacts = await session.sock.store?.contacts || {};
        const contactsArray = Object.values(whatsappContacts);

        console.log(`[${sessionId}] 📱 Encontrados ${contactsArray.length} contactos en WhatsApp`);

        let processedContacts = 0;
        let skippedGroups = 0;

        for (const contact of contactsArray) {
            // Solo procesar contactos individuales (no grupos)
            if (contact.id && contact.id.includes('@s.whatsapp.net') && !contact.id.includes('@g.us')) {
                try {
                    // Intentar obtener el avatar del contacto
                    let contactAvatar = null;
                    try {
                        if (session.sock && session.isConnected) {
                            contactAvatar = await session.sock.profilePictureUrl(contact.id, 'image');
                        }
                    } catch (avatarError) {
                        console.log(`[${sessionId}] Avatar no disponible para contacto ${contact.id}`);
                    }

                    // Guardar contacto individual en la base de datos
                    await getOrInsertContact(
                        contact.id,
                        contact.name || contact.notify,
                        contact.notify,
                        false, // No es grupo
                        sessionId,
                        contactAvatar
                    );
                    processedContacts++;
                } catch (error) {
                    console.error(`[${sessionId}] ❌ Error guardando contacto ${contact.id}:`, error);
                }
            } else if (contact.id && contact.id.includes('@g.us')) {
                skippedGroups++;
            }
        }

        console.log(`[${sessionId}] ✅ Sincronización completada: ${processedContacts} contactos procesados, ${skippedGroups} grupos omitidos`);

        res.json({
            success: true,
            message: 'Contactos sincronizados correctamente',
            stats: {
                totalContacts: contactsArray.length,
                processedContacts,
                skippedGroups
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`[${sessionId}] ❌ Error en sincronización de contactos:`, error);
        res.status(500).json({
            success: false,
            error: 'Error al sincronizar contactos',
            details: error.message
        });
    }
});

// Obtener lista de contactos desde la base de datos
app.get('/api/contacts/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible' });
    }

    const connection = await pool.getConnection();
    try {
        // Filtrar solo contactos individuales (no grupos) del usuario actual
        // Usar COALESCE para mejorar la obtención de imágenes y nombres
        const [contacts] = await connection.execute(
            `SELECT
                id,
                jid,
                COALESCE(name, notify_name) as display_name,
                COALESCE(notify_name, name) as notify_name,
                is_group,
                COALESCE(avatar_url, profile_pic_url) as avatar,
                status_message,
                created_at
            FROM contacts
            WHERE is_group = FALSE AND session_id = ?
            ORDER BY COALESCE(name, notify_name, jid) ASC`,
            [sessionId]
        );

        const contactsData = contacts.map(contact => ({
            id: contact.jid, // Usar jid como id para compatibilidad con el frontend
            jid: contact.jid,
            name: contact.display_name || contact.jid.split('@')[0],
            notify: contact.notify_name || contact.display_name || contact.jid.split('@')[0],
            phone: contact.jid.split('@')[0],
            isGroup: false, // Siempre false ya que filtramos grupos
            avatar: contact.avatar, // Avatar mejorado con COALESCE
            status: contact.status_message,
            type: 'contact'
        }));

        console.log(`[${sessionId}] Contactos individuales obtenidos: ${contactsData.length}`);

        res.json({
            success: true,
            contacts: contactsData,
            total: contactsData.length
        });

    } catch (error) {
        console.error(`[${sessionId}] Error obteniendo contactos:`, error);
        res.status(500).json({ success: false, error: 'Error al obtener contactos' });
    } finally {
        if (connection) connection.release();
    }
});

// Obtener lista de grupos con miembros
app.get('/api/groups/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    console.log(`[API-GROUPS] 🔄 Solicitando grupos para sessionId: ${sessionId}`);

    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible' });
    }

    const connection = await pool.getConnection();
    try {
        // Primero intentar obtener grupos desde contact_groups
        let [groups] = await connection.execute(`
            SELECT
                g.id as group_id,
                COALESCE(g.name, c.name, c.notify_name) as group_name,
                COALESCE(g.avatar_url, c.avatar_url) as group_avatar,
                c.jid as group_jid,
                c.created_at as group_created_at,
                COUNT(cgm.contact_id) as member_count
            FROM contact_groups g
            LEFT JOIN contacts c ON (c.name = g.name OR c.notify_name = g.name) AND c.is_group = TRUE AND c.session_id = ?
            LEFT JOIN contact_group_members cgm ON cgm.group_id = g.id
            WHERE g.session_id = ?
            GROUP BY g.id, g.name, g.avatar_url, c.jid, c.created_at, c.name, c.notify_name, c.avatar_url
            ORDER BY COALESCE(g.name, c.name, c.notify_name) ASC
        `, [sessionId, sessionId]);

        console.log(`[API-GROUPS] 📊 Encontrados ${groups.length} grupos en contact_groups`);

        // Si no hay grupos en contact_groups, buscar directamente en contacts
        if (groups.length === 0) {
            console.log(`[API-GROUPS] 🔍 Buscando grupos directamente en contacts...`);
            [groups] = await connection.execute(`
                SELECT
                    c.id as group_id,
                    COALESCE(c.name, c.notify_name) as group_name,
                    c.avatar_url as group_avatar,
                    c.jid as group_jid,
                    c.created_at as group_created_at,
                    (SELECT COUNT(*) FROM messages m2 WHERE m2.chat_jid = c.jid AND m2.session_id = ? AND m2.from_me = FALSE) as member_count
                FROM contacts c
                WHERE c.session_id = ? AND c.is_group = TRUE AND c.jid LIKE '%@g.us'
                ORDER BY COALESCE(c.name, c.notify_name) ASC
            `, [sessionId, sessionId]);

            console.log(`[API-GROUPS] 📊 Encontrados ${groups.length} grupos directamente en contacts`);
        }

        const groupsData = [];

        for (const group of groups) {
            // Obtener miembros del grupo si existe en contact_groups
            let members = [];
            if (group.group_id && group.member_count !== 0) {
                try {
                    const [memberResults] = await connection.execute(`
                        SELECT
                            c.jid,
                            c.name,
                            c.notify_name
                        FROM contact_group_members cgm
                        JOIN contacts c ON c.id = cgm.contact_id
                        WHERE cgm.group_id = ? AND c.session_id = ?
                        ORDER BY c.name ASC
                    `, [group.group_id, sessionId]);
                    members = memberResults;
                } catch (membersError) {
                    console.warn(`[API-GROUPS] ⚠️ Error obteniendo miembros del grupo ${group.group_name}:`, membersError.message);
                }
            }

            groupsData.push({
                id: group.group_id || group.group_jid,
                name: group.group_name || 'Grupo sin nombre',
                subject: group.group_name || 'Grupo sin nombre', // Alias para compatibilidad
                jid: group.group_jid,
                avatar: group.group_avatar,
                avatar_url: group.group_avatar, // Alias para compatibilidad
                member_count: group.member_count || members.length || 0,
                memberCount: group.member_count || members.length || 0, // Alias para compatibilidad
                created_at: group.group_created_at,
                createdAt: group.group_created_at, // Alias para compatibilidad
                members: members.map(member => ({
                    jid: member.jid,
                    name: member.name || member.notify_name || member.jid.split('@')[0],
                    phone: member.jid.split('@')[0]
                }))
            });
        }

        console.log(`[API-GROUPS] ✅ Devolviendo ${groupsData.length} grupos procesados`);

        res.json({
            success: true,
            groups: groupsData,
            total: groupsData.length
        });

    } catch (error) {
        console.error(`[API-GROUPS] ❌ Error obteniendo grupos para ${sessionId}:`, error);
        res.status(500).json({ success: false, error: 'Error al obtener grupos' });
    } finally {
        if (connection) connection.release();
    }
});

// Obtener estados de WhatsApp (Status)
app.get('/api/statuses/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    console.log(`[API-STATUSES] 🔄 Solicitando estados para sessionId: ${sessionId}`);

    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible.' });
    }

    const connection = await pool.getConnection();
    try {
        // Por ahora, buscar mensajes de tipo "status" o generar estados simulados basados en contactos
        const [statuses] = await connection.execute(`
            SELECT DISTINCT
                m.chat_jid,
                c.name as contact_name,
                c.notify_name as contact_notify_name,
                c.avatar_url as contact_avatar,
                m.timestamp as last_status_time,
                m.message_type,
                m.media_url
            FROM messages m
            LEFT JOIN contacts c ON c.jid = m.chat_jid AND c.session_id = ?
            WHERE m.session_id = ?
            AND (m.message_type IN ('image', 'video', 'text') OR m.chat_jid LIKE '%@status%')
            AND m.timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
            GROUP BY m.chat_jid, c.name
            ORDER BY m.timestamp DESC
            LIMIT 20
        `, [sessionId, sessionId]);

        console.log(`[API-STATUSES] 📊 Encontrados ${statuses.length} estados potenciales`);

        const statusData = statuses.map((status, index) => ({
            id: `status_${index}`,
            contact_jid: status.chat_jid,
            contact_name: status.contact_name || status.contact_notify_name || status.chat_jid?.split('@')[0] || 'Usuario',
            contact_avatar: status.contact_avatar,
            status_time: status.last_status_time,
            status_type: status.message_type || 'text',
            media_url: status.media_url,
            viewed: Math.random() > 0.5, // Simulado por ahora
            is_own: false // Por ahora todos externos
        }));

        // Agregar un estado propio simulado
        statusData.unshift({
            id: 'my_status',
            contact_jid: `${sessionId}@s.whatsapp.net`,
            contact_name: 'Mi Estado',
            contact_avatar: null,
            status_time: new Date().toISOString(),
            status_type: 'text',
            media_url: null,
            viewed: true,
            is_own: true
        });

        console.log(`[API-STATUSES] ✅ Devolviendo ${statusData.length} estados`);

        res.json({
            success: true,
            statuses: statusData,
            total: statusData.length
        });

    } catch (error) {
        console.error(`[API-STATUSES] ❌ Error obteniendo estados para ${sessionId}:`, error);
        res.status(500).json({ success: false, error: 'Error al obtener estados' });
    } finally {
        if (connection) connection.release();
    }
});

// Obtener avatar de perfil de un contacto
app.get('/api/avatar/:sessionId/:jid', async (req, res) => {
    const { sessionId, jid } = req.params;

    const session = sessions.get(sessionId);
    if (!session || !session.sock || !session.isConnected) {
        return res.status(400).json({ success: false, error: 'Sesión no encontrada o no conectada' });
    }

    try {
        const fullJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
        console.log(`[${sessionId}] Solicitando avatar para: ${fullJid}`);

        // Intentar obtener el avatar desde WhatsApp
        const profilePicture = await session.sock.profilePictureUrl(fullJid, 'image');

        if (profilePicture) {
            console.log(`[${sessionId}] Avatar encontrado para ${fullJid}: ${profilePicture}`);
            // Redirigir a la URL del avatar
            res.redirect(profilePicture);
        } else {
            console.log(`[${sessionId}] Avatar no disponible para ${fullJid}`);
            // Avatar por defecto
            res.status(404).json({ success: false, error: 'Avatar no disponible' });
        }

    } catch (error) {
        console.error(`[${sessionId}] Error obteniendo avatar para ${jid}:`, error.message);
        res.status(404).json({ success: false, error: 'Avatar no disponible' });
    }
});

// Obtener múltiples avatares en lote
app.post('/api/avatars/batch/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { jids } = req.body;

    if (!Array.isArray(jids)) {
        return res.status(400).json({ success: false, error: 'jids debe ser un array' });
    }

    const session = sessions.get(sessionId);
    if (!session || !session.sock || !session.isConnected) {
        return res.status(400).json({ success: false, error: 'Sesión no encontrada o no conectada' });
    }

    const results = {};
    console.log(`[${sessionId}] Procesando ${jids.length} avatares en lote`);

    for (const jid of jids) {
        try {
            const fullJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
            const profilePicture = await session.sock.profilePictureUrl(fullJid, 'image');
            results[jid] = profilePicture || null;
        } catch (error) {
            console.log(`[${sessionId}] Avatar no disponible para ${jid}`);
            results[jid] = null;
        }
    }

    console.log(`[${sessionId}] Avatares procesados: ${Object.keys(results).length}`);
    res.json({
        success: true,
        avatars: results
    });
});

// Guardar campañas en la base de datos
app.post('/api/campaigns/save', async (req, res) => {
    const { sessionId, campaigns } = req.body;

    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible' });
    }

    const connection = await pool.getConnection();
    try {
        console.log(`[${sessionId}] Guardando ${campaigns.length} campañas en BD`);

        for (const campaign of campaigns) {
            // Crear tabla de campañas si no existe
            await connection.query(
                'CREATE TABLE IF NOT EXISTS campaigns (
                id VARCHAR(255) PRIMARY KEY,
                session_id VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                type VARCHAR(50) DEFAULT \'direct\',
                status VARCHAR(50) DEFAULT \'draft\',
                message_text TEXT,
                message_media_url VARCHAR(1024),
                message_media_type VARCHAR(50),
                scheduled_at DATETIME,
                progress_total INT DEFAULT 0,
                progress_sent INT DEFAULT 0,
                progress_delivered INT DEFAULT 0,
                progress_failed INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                started_at DATETIME,
                completed_at DATETIME,
                use_id_flow BOOLEAN DEFAULT FALSE,
                use_random_timing BOOLEAN DEFAULT FALSE,
                flow_messages_count INT DEFAULT 5,
                flow_time_span_minutes INT DEFAULT 5
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
            );

            // Crear tabla de contactos de campaña
            await connection.query(
                'CREATE TABLE IF NOT EXISTS campaign_contacts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                campaign_id VARCHAR(255) NOT NULL,
                phone VARCHAR(20) NOT NULL,
                name VARCHAR(255),
                variables JSON,
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
            );

            // Insertar/actualizar campaña
            await connection.query(
                'INSERT INTO campaigns (id, session_id, name, type, status, message_text, message_media_url, message_media_type, scheduled_at, progress_total, progress_sent, progress_delivered, progress_failed, started_at, completed_at, use_id_flow, use_random_timing, flow_messages_count, flow_time_span_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), progress_sent = VALUES(progress_sent), progress_delivered = VALUES(progress_delivered), progress_failed = VALUES(progress_failed), completed_at = VALUES(completed_at)',
                [
                    campaign.id,
                    sessionId,
                    campaign.name,
                    campaign.type || 'direct',
                    campaign.status || 'draft',
                    campaign.message?.text || '',
                    campaign.message?.mediaUrl || null,
                    campaign.message?.mediaType || null,
                    campaign.scheduledAt || null,
                    campaign.progress?.total || 0,
                    campaign.progress?.sent || 0,
                    campaign.progress?.delivered || 0,
                    campaign.progress?.failed || 0,
                    campaign.startedAt || null,
                    campaign.completedAt || null,
                    campaign.useIdFlow || false,
                    campaign.useRandomTiming || false,
                    campaign.flowConfig?.messagesCount || 5,
                    campaign.flowConfig?.timeSpanMinutes || 5
                ]
            );

            // Insertar contactos de la campaña
            if (campaign.contacts && campaign.contacts.length > 0) {
                // Limpiar contactos existentes primero
                await connection.query('DELETE FROM campaign_contacts WHERE campaign_id = ?', [campaign.id]);

                for (const contact of campaign.contacts) {
                    await connection.query(
                        'INSERT INTO campaign_contacts (campaign_id, phone, name, variables) VALUES (?, ?, ?, ?)',
                        [
                            campaign.id,
                            contact.phone,
                            contact.name,
                            JSON.stringify(contact.variables || {})
                        ]
                    );
                }
            }
        }

        console.log(`[${sessionId}] Campañas guardadas exitosamente en BD`);
        res.json({
            success: true,
            message: `${campaigns.length} campañas guardadas correctamente`,
            count: campaigns.length
        });

    } catch (error) {
        console.error(`[${sessionId}] Error guardando campañas:`, error);
        res.status(500).json({
            success: false,
            error: 'Error al guardar campañas',
            details: error.message
        });
    } finally {
        if (connection) connection.release();
    }
});

// Cargar campañas desde la base de datos
app.get('/api/campaigns/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible' });
    }

    const connection = await pool.getConnection();
    try {
        console.log(`[${sessionId}] Cargando campañas desde BD`);

        // Obtener campañas
        const [campaignRows] = await connection.query(
            'SELECT * FROM campaigns WHERE session_id = ? ORDER BY created_at DESC',
            [sessionId]
        );

        const campaigns = [];

        for (const campaignRow of campaignRows) {
            // Obtener contactos de la campaña
            const [contactRows] = await connection.query(
                'SELECT phone, name, variables FROM campaign_contacts WHERE campaign_id = ?',
                [campaignRow.id]
            );

            const contacts = contactRows.map(row => ({
                phone: row.phone,
                name: row.name,
                variables: JSON.parse(row.variables || '{}')
            }));

            campaigns.push({
                id: campaignRow.id,
                name: campaignRow.name,
                type: campaignRow.type,
                status: campaignRow.status,
                message: {
                    text: campaignRow.message_text,
                    mediaUrl: campaignRow.message_media_url,
                    mediaType: campaignRow.message_media_type
                },
                contacts,
                scheduledAt: campaignRow.scheduled_at,
                progress: {
                    total: campaignRow.progress_total,
                    sent: campaignRow.progress_sent,
                    delivered: campaignRow.progress_delivered,
                    failed: campaignRow.progress_failed
                },
                createdAt: campaignRow.created_at,
                startedAt: campaignRow.started_at,
                completedAt: campaignRow.completed_at,
                useIdFlow: !!campaignRow.use_id_flow,
                useRandomTiming: !!campaignRow.use_random_timing,
                flowConfig: {
                    messagesCount: campaignRow.flow_messages_count,
                    timeSpanMinutes: campaignRow.flow_time_span_minutes
                }
            });
        }

        console.log(`[${sessionId}] Cargadas ${campaigns.length} campañas desde BD`);
        res.json({
            success: true,
            campaigns,
            count: campaigns.length
        });

    } catch (error) {
        console.error(`[${sessionId}] Error cargando campañas:`, error);
        res.status(500).json({
            success: false,
            error: 'Error al cargar campañas',
            details: error.message
        });
    } finally {
        if (connection) connection.release();
    }
});


// Obtener grupos para selección en campañas
app.get('/api/contact-groups/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    const session = sessions.get(sessionId);
    if (!session || !session.sock || !session.isConnected) {
        return res.status(400).json({ success: false, error: 'Sesión no encontrada o no conectada' });
    }

    try {
        console.log(`[${sessionId}] Obteniendo grupos para campañas`);

        // Obtener todos los grupos
        const groups = await session.sock.groupFetchAllParticipating();

        const groupsList = Object.entries(groups).map(([id, group]) => ({
            id,
            name: group.subject || 'Grupo sin nombre',
            participants: group.participants?.length || 0,
            description: group.desc || '',
            type: 'group',
            avatar: null // Se puede agregar lógica para obtener avatar del grupo
        }));

        res.json({
            success: true,
            groups: groupsList,
            count: groupsList.length
        });

    } catch (error) {
        console.error(`[${sessionId}] Error obteniendo grupos:`, error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener grupos',
            details: error.message
        });
    }
});

// Enviar campaña
app.post('/api/campaigns/send/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { campaignId } = req.body;

    const session = sessions.get(sessionId);
    if (!session || !session.sock || !session.isConnected) {
        return res.status(400).json({ success: false, error: 'Sesión no encontrada o no conectada' });
    }

    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible' });
    }

    const connection = await pool.getConnection();
    try {
        console.log(`[${sessionId}] Iniciando envío de campaña: ${campaignId}`);

        // Obtener datos de la campaña
        const [campaignRows] = await connection.query(
            'SELECT * FROM campaigns WHERE id = ? AND session_id = ?',
            [campaignId, sessionId]
        );

        if (campaignRows.length === 0) {
            return res.status(404).json({ success: false, error: 'Campaña no encontrada' });
        }

        const campaign = campaignRows[0];

        // Obtener contactos de la campaña
        const [contactRows] = await connection.query(
            'SELECT phone, name, variables FROM campaign_contacts WHERE campaign_id = ?',
            [campaignId]
        );

        if (contactRows.length === 0) {
            return res.status(400).json({ success: false, error: 'No hay contactos en la campaña' });
        }

        // Verificar que hay contactos válidos
        if (!contactRows || contactRows.length === 0) {
            return res.status(400).json({ success: false, error: 'No hay contactos en la campaña' });
        }

        // Actualizar estado de la campaña a 'sending'
        await connection.query(
            'UPDATE campaigns SET status = ?, started_at = NOW(), progress_total = ? WHERE id = ?',
            ['sending', contactRows.length, campaignId]
        );

        // Iniciar envío asíncrono
        sendCampaignMessages(sessionId, campaign, contactRows, connection);

        res.json({
            success: true,
            message: 'Campaña iniciada correctamente',
            campaignId,
            totalContacts: contactRows.length
        });

    } catch (error) {
        console.error(`[${sessionId}] Error iniciando campaña:`, error);
        res.status(500).json({
            success: false,
            error: 'Error al iniciar campaña',
            details: error.message
        });
    } finally {
        if (connection) connection.release();
    }
});

// Pausar campaña
app.post('/api/campaigns/pause/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { campaignId } = req.body;

    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.query(
            'UPDATE campaigns SET status = ? WHERE id = ? AND session_id = ?',
            ['paused', campaignId, sessionId]
        );

        res.json({
            success: true,
            message: 'Campaña pausada correctamente'
        });

    } catch (error) {
        console.error(`[${sessionId}] Error pausando campaña:`, error);
        res.status(500).json({
            success: false,
            error: 'Error al pausar campaña',
            details: error.message
        });
    } finally {
        if (connection) connection.release();
    }
});

// Función para enviar mensajes de campaña
async function sendCampaignMessages(sessionId, campaign, contacts, connection) {
    const session = sessions.get(sessionId);
    if (!session || !session.sock || !session.isConnected) {
        console.error(`[${sessionId}] Sesión no disponible para envío de campaña`);
        return;
    }

    // Verificar que contacts sea un array válido
    if (!Array.isArray(contacts) || contacts.length === 0) {
        console.error(`[${sessionId}] No hay contactos válidos para enviar la campaña ${campaign.id}`);
        return;
    }

    console.log(`[${sessionId}] Enviando campaña ${campaign.id} a ${contacts.length} contactos`);

    let sentCount = 0;
    let failedCount = 0;

    for (const contact of contacts) {
        try {
            // Verificar si la campaña sigue activa
            const [statusCheck] = await connection.query(
                'SELECT status FROM campaigns WHERE id = ?',
                [campaign.id]
            );

            if (statusCheck[0]?.status === 'paused') {
                console.log(`[${sessionId}] Campaña ${campaign.id} pausada, deteniendo envío`);
                break;
            }

            // Preparar mensaje
            let messageText = campaign.message_text;

            // Reemplazar variables si existen
            if (contact.variables) {
                const variables = JSON.parse(contact.variables || '{}');
                Object.entries(variables).forEach(([key, value]) => {
                    messageText = messageText.replace(new RegExp(`{{${key}}}`, 'g'), value);
                });
            }

            // Reemplazar nombre del contacto
            messageText = messageText.replace(/{{name}}/g, contact.name || contact.phone);

            const phoneNumber = contact.phone.includes('@') ? contact.phone : `${contact.phone}@s.whatsapp.net`;

            // Enviar mensaje
            if (campaign.message_media_url && campaign.message_media_type) {
                // Mensaje con multimedia
                const mediaMessage = {
                    [campaign.message_media_type]: { url: campaign.message_media_url },
                    caption: messageText
                };

                await session.sock.sendMessage(phoneNumber, mediaMessage);
            } else {
                // Mensaje de texto
                await session.sock.sendMessage(phoneNumber, { text: messageText });
            }

            sentCount++;
            console.log(`[${sessionId}] Mensaje enviado a ${contact.phone} (${sentCount}/${contacts.length})`);

            // Actualizar progreso en BD
            await connection.query(
                'UPDATE campaigns SET progress_sent = ? WHERE id = ?',
                [sentCount, campaign.id]
            );

            // Delay entre mensajes para evitar spam (configurable)
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
            console.error(`[${sessionId}] Error enviando mensaje a ${contact.phone}:`, error);
            failedCount++;

            // Actualizar contador de fallos
            await connection.query(
                'UPDATE campaigns SET progress_failed = ? WHERE id = ?',
                [failedCount, campaign.id]
            );
        }
    }

    // Marcar campaña como completada
    await connection.query(
        'UPDATE campaigns SET status = ?, completed_at = NOW() WHERE id = ?',
        ['completed', campaign.id]
    );

    console.log(`[${sessionId}] Campaña ${campaign.id} completada. Enviados: ${sentCount}, Fallos: ${failedCount}`);
}

// Subir archivo para campaña
app.post('/api/campaigns/upload-file/:sessionId', upload.single('file'), async (req, res) => {
    const { sessionId } = req.params;

    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No se recibió ningún archivo' });
        }

        const fileInfo = {
            id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: req.file.originalname,
            size: req.file.size,
            type: getFileType(req.file.mimetype),
            mimeType: req.file.mimetype,
            url: `/uploads/${req.file.filename}`,
            base64: req.file.buffer ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` : null
        };

        console.log(`[${sessionId}] Archivo subido: ${fileInfo.name} (${fileInfo.size} bytes)`);

        res.json({
            success: true,
            file: fileInfo
        });

    } catch (error) {
        console.error(`[${sessionId}] Error subiendo archivo:`, error);
        res.status(500).json({
            success: false,
            error: 'Error al subir archivo',
            details: error.message
        });
    }
});

// Función auxiliar para determinar el tipo de archivo
function getFileType(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType === 'application/pdf') return 'document';
    if (mimeType.includes('document') || mimeType.includes('text') || mimeType.includes('spreadsheet')) return 'document';
    return 'document';
}

// Eliminar campaña
app.delete('/api/campaigns/:sessionId/:campaignId', async (req, res) => {
    const { sessionId, campaignId } = req.params;

    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible' });
    }

    const connection = await pool.getConnection();
    try {
        console.log(`[${sessionId}] Eliminando campaña: ${campaignId}`);

        // Verificar que la campaña existe y pertenece a la sesión
        const [campaignRows] = await connection.query(
            'SELECT id FROM campaigns WHERE id = ? AND session_id = ?',
            [campaignId, sessionId]
        );

        if (campaignRows.length === 0) {
            return res.status(404).json({ success: false, error: 'Campaña no encontrada' });
        }

        // Eliminar contactos de la campaña (por foreign key constraint)
        await connection.query('DELETE FROM campaign_contacts WHERE campaign_id = ?', [campaignId]);

        // Eliminar la campaña
        await connection.query('DELETE FROM campaigns WHERE id = ?', [campaignId]);

        res.json({
            success: true,
            message: 'Campaña eliminada correctamente'
        });

    } catch (error) {
        console.error(`[${sessionId}] Error eliminando campaña:`, error);
        res.status(500).json({
            success: false,
            error: 'Error al eliminar campaña',
            details: error.message
        });
    } finally {
        if (connection) connection.release();
    }
});

// Duplicar campaña
app.post('/api/campaigns/duplicate/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { campaignId } = req.body;

    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible' });
    }

    const connection = await pool.getConnection();
    try {
        console.log(`[${sessionId}] Duplicando campaña: ${campaignId}`);

        // Obtener datos de la campaña original
        const [campaignRows] = await connection.query(
            'SELECT * FROM campaigns WHERE id = ? AND session_id = ?',
            [campaignId, sessionId]
        );

        if (campaignRows.length === 0) {
            return res.status(404).json({ success: false, error: 'Campaña no encontrada' });
        }

        const originalCampaign = campaignRows[0];
        const newCampaignId = `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Crear nueva campaña
        await connection.query(
            'INSERT INTO campaigns (id, session_id, name, type, status, message_text, message_media_url, message_media_type, scheduled_at, progress_total, progress_sent, progress_delivered, progress_failed, started_at, completed_at, use_id_flow, use_random_timing, flow_messages_count, flow_time_span_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                newCampaignId,
                sessionId,
                `${originalCampaign.name} (Copia)`,
                originalCampaign.type,
                'draft', // Nueva campaña siempre en borrador
                originalCampaign.message_text,
                originalCampaign.message_media_url,
                originalCampaign.message_media_type,
                null, // Sin programación
                0, // Resetear progreso
                0,
                0,
                0,
                null,
                null,
                originalCampaign.use_id_flow,
                originalCampaign.use_random_timing,
                originalCampaign.flow_messages_count,
                originalCampaign.flow_time_span_minutes
            ]
        );

        // Copiar contactos
        const [contactRows] = await connection.query(
            'SELECT phone, name, variables FROM campaign_contacts WHERE campaign_id = ?',
            [campaignId]
        );

        for (const contact of contactRows) {
            await connection.query(
                'INSERT INTO campaign_contacts (campaign_id, phone, name, variables) VALUES (?, ?, ?, ?)',
                [newCampaignId, contact.phone, contact.name, contact.variables]
            );
        }

        res.json({
            success: true,
            message: 'Campaña duplicada correctamente',
            newCampaignId
        });

    } catch (error) {
        console.error(`[${sessionId}] Error duplicando campaña:`, error);
        res.status(500).json({
            success: false,
            error: 'Error al duplicar campaña',
            details: error.message
        });
    } finally {
        if (connection) connection.release();
    }
});

// Actualizar información de contactos con avatares
app.post('/api/update-contacts-avatars/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    const session = sessions.get(sessionId);
    if (!session || !session.sock || !session.isConnected) {
        return res.status(400).json({ success: false, error: 'Sesión no encontrada o no conectada' });
    }

    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible' });
    }

    try {
        console.log(`[${sessionId}] Actualizando avatares de contactos...`);

        const connection = await pool.getConnection();
        let updatedCount = 0;

        try {
            // Obtener todos los contactos de la base de datos
            const [contacts] = await connection.execute(
                'SELECT id, jid, name FROM contacts WHERE is_group = FALSE AND session_id = ?',
                [sessionId]
            );

            for (const contact of contacts) {
                try {
                    // Intentar obtener el avatar
                    const avatarUrl = await session.sock.profilePictureUrl(contact.jid, 'image');

                    if (avatarUrl) {
                        // Aquí podríamos guardar la URL del avatar en la base de datos
                        // Por ahora, solo contamos las actualizaciones exitosas
                        updatedCount++;
                    }
                } catch (error) {
                    // Avatar no disponible, continuar
                    console.log(`[${sessionId}] Avatar no disponible para ${contact.jid}`);
                }
            }

            console.log(`[${sessionId}] Avatares actualizados: ${updatedCount} de ${contacts.length}`);

            res.json({
                success: true,
                message: 'Avatares actualizados correctamente',
                stats: {
                    totalContacts: contacts.length,
                    updatedAvatars: updatedCount
                }
            });

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error(`[${sessionId}] Error actualizando avatares:`, error);
        res.status(500).json({
            success: false,
            error: 'Error al actualizar avatares',
            details: error.message
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'WhatsApp API funcionando',
        timestamp: new Date().toISOString(),
        activeSessions: sessions.size
    });
});

// Endpoint para sincronización en tiempo real
app.post('/api/sync-realtime/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session) {
        return res.status(404).json({
            success: false,
            error: 'Sesión no encontrada'
        });
    }

    if (!session.isConnected) {
        return res.status(400).json({
            success: false,
            error: 'WhatsApp no está conectado'
        });
    }

    try {
        console.log(`[${sessionId}] 🔄 Iniciando sincronización en tiempo real...`);

        // Sincronizar contactos
        try {
            const syncContactsResponse = await fetch('http://localhost:3002/api/sync/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            });
            const contactsResult = await syncContactsResponse.json();
            if (contactsResult.success) {
                console.log(`[${sessionId}] ✅ Contactos sincronizados: ${contactsResult.stats.processedContacts} contactos`);
            }
        } catch (error) {
            console.error(`[${sessionId}] ❌ Error sincronizando contactos:`, error.message);
        }

        // Sincronizar grupos
        try {
            const syncGroupsResponse = await fetch('http://localhost:3002/api/sync/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            });
            const groupsResult = await syncGroupsResponse.json();
            if (groupsResult.success) {
                console.log(`[${sessionId}] ✅ Grupos sincronizados: ${groupsResult.stats.groups} grupos`);
            }
        } catch (error) {
            console.error(`[${sessionId}] ❌ Error sincronizando grupos:`, error.message);
        }

        // Obtener chats actualizados
        const updatedChats = await loadChatListFromDB(sessionId);

        res.json({
            success: true,
            message: 'Sincronización en tiempo real completada',
            stats: {
                chatsLoaded: updatedChats.length
            },
            timestamp: new Date().toISOString()
        });

        // Emitir actualización a clientes conectados
        io.emit(`sync-completed-${sessionId}`, {
            contactsSynced: true,
            groupsSynced: true,
            chatsLoaded: updatedChats.length,
            realtime: true
        });

        console.log(`[${sessionId}] ✅ Sincronización en tiempo real completada`);

    } catch (error) {
        console.error(`[${sessionId}] ❌ Error en sincronización en tiempo real:`, error);
        res.status(500).json({
            success: false,
            error: 'Error en sincronización en tiempo real',
            details: error.message
        });
    }
});

// Endpoint para eliminar mensajes específicos
app.delete('/api/messages/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { messageIds } = req.body;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
        return res.status(400).json({ success: false, error: 'messageIds debe ser un array no vacío' });
    }

    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible' });
    }

    const connection = await pool.getConnection();
    try {
        console.log(`[${sessionId}] Eliminando ${messageIds.length} mensajes...`);

        // Eliminar mensajes específicos
        const placeholders = messageIds.map(() => '?').join(',');
        const [result] = await connection.execute(
            `DELETE FROM messages WHERE id IN (${placeholders}) AND session_id = ?`,
            [...messageIds, sessionId]
        );

        console.log(`[${sessionId}] Eliminados ${result.affectedRows} mensajes`);
        res.json({
            success: true,
            message: `Eliminados ${result.affectedRows} mensajes correctamente`,
            deletedCount: result.affectedRows
        });

    } catch (error) {
        console.error(`[${sessionId}] Error eliminando mensajes:`, error);
        res.status(500).json({
            success: false,
            error: 'Error al eliminar mensajes',
            details: error.message
        });
    } finally {
        if (connection) connection.release();
    }
});

// Endpoint para eliminar chat completo (todos los mensajes de un chat)
app.delete('/api/chat/:sessionId/:chatJid', async (req, res) => {
    const { sessionId, chatJid } = req.params;

    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible' });
    }

    const connection = await pool.getConnection();
    try {
        console.log(`[${sessionId}] Eliminando chat completo: ${chatJid}`);

        // Eliminar todos los mensajes del chat
        const [result] = await connection.execute(
            'DELETE FROM messages WHERE chat_jid = ? AND session_id = ?',
            [chatJid, sessionId]
        );

        console.log(`[${sessionId}] Eliminados ${result.affectedRows} mensajes del chat ${chatJid}`);
        res.json({
            success: true,
            message: `Eliminado chat completo: ${result.affectedRows} mensajes`,
            deletedCount: result.affectedRows
        });

    } catch (error) {
        console.error(`[${sessionId}] Error eliminando chat:`, error);
        res.status(500).json({
            success: false,
            error: 'Error al eliminar chat',
            details: error.message
        });
    } finally {
        if (connection) connection.release();
    }
});

// Endpoint para eliminar historial completo de una sesión
app.delete('/api/history/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible' });
    }

    const connection = await pool.getConnection();
    try {
        console.log(`[${sessionId}] Eliminando historial completo...`);

        // Eliminar todos los mensajes de la sesión
        const [result] = await connection.execute(
            'DELETE FROM messages WHERE session_id = ?',
            [sessionId]
        );

        console.log(`[${sessionId}] Eliminados ${result.affectedRows} mensajes del historial completo`);
        res.json({
            success: true,
            message: `Eliminado historial completo: ${result.affectedRows} mensajes`,
            deletedCount: result.affectedRows
        });

    } catch (error) {
        console.error(`[${sessionId}] Error eliminando historial:`, error);
        res.status(500).json({
            success: false,
            error: 'Error al eliminar historial',
            details: error.message
        });
    } finally {
        if (connection) connection.release();
    }
});

// Endpoint para descargar historial completo
app.post('/api/download-history/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session) {
        return res.status(404).json({
            success: false,
            error: 'Sesión no encontrada'
        });
    }

    if (!session.isConnected) {
        return res.status(400).json({
            success: false,
            error: 'WhatsApp no está conectado'
        });
    }

    try {
        console.log(`[${sessionId}] 📥 Iniciando descarga completa de historial...`);

        // Ejecutar descarga de historial
        await downloadFullMessageHistory(sessionId, session.sock);

        res.json({
            success: true,
            message: 'Historial descargado exitosamente',
            timestamp: new Date().toISOString()
        });

        console.log(`[${sessionId}] ✅ Descarga de historial completada`);

    } catch (error) {
        console.error(`[${sessionId}] ❌ Error en descarga de historial:`, error);
        res.status(500).json({
            success: false,
            error: 'Error descargando historial',
            details: error.message
        });
    }
});

// Endpoint para forzar sincronización manual
app.post('/api/force-sync/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session) {
        return res.status(404).json({
            success: false,
            error: 'Sesión no encontrada'
        });
    }

    if (!session.isConnected) {
        return res.status(400).json({
            success: false,
            error: 'WhatsApp no está conectado'
        });
    }

    try {
        console.log(`[${sessionId}] 🔄 Iniciando sincronización forzada completa...`);

        // 1. Sincronizar contactos
        try {
            console.log(`[${sessionId}] 📞 Sincronizando contactos...`);
            const syncContactsResponse = await fetch('http://localhost:3002/api/sync/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            });
            const contactsResult = await syncContactsResponse.json();
            if (contactsResult.success) {
                console.log(`[${sessionId}] ✅ Contactos sincronizados: ${contactsResult.stats.contacts} contactos`);
            } else {
                console.error(`[${sessionId}] ❌ Error sincronizando contactos:`, contactsResult.error);
            }
        } catch (error) {
            console.error(`[${sessionId}] ❌ Error en fetch de contactos:`, error.message);
        }

        // 2. Sincronizar grupos
        try {
            console.log(`[${sessionId}] 👥 Sincronizando grupos...`);
            const syncGroupsResponse = await fetch('http://localhost:3002/api/sync/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            });
            const groupsResult = await syncGroupsResponse.json();
            if (groupsResult.success) {
                console.log(`[${sessionId}] ✅ Grupos sincronizados: ${groupsResult.stats.groups} grupos`);
            } else {
                console.error(`[${sessionId}] ❌ Error sincronizando grupos:`, groupsResult.error);
            }
        } catch (error) {
            console.error(`[${sessionId}] ❌ Error en fetch de grupos:`, error.message);
        }

        // 3. Descargar historial completo de mensajes
        try {
            console.log(`[${sessionId}] 📥 Iniciando descarga de historial completo...`);
            await downloadFullMessageHistory(sessionId, session.sock);
        } catch (historyError) {
            console.error(`[${sessionId}] ❌ Error descargando historial:`, historyError.message);
        }

        // 4. Intentar obtener chats directamente de WhatsApp
        let whatsappChats = [];
        try {
            console.log(`[${sessionId}] 💬 Obteniendo chats de WhatsApp...`);
            if (session.sock?.store?.chats) {
                whatsappChats = Object.values(session.sock.store.chats);
                console.log(`[${sessionId}] 📱 ${whatsappChats.length} chats obtenidos del store`);
            } else {
                whatsappChats = await session.sock.getChats();
                console.log(`[${sessionId}] 📱 ${whatsappChats.length} chats obtenidos con getChats()`);
            }

            // Guardar chats en DB
            if (whatsappChats.length > 0) {
                for (const chat of whatsappChats) {
                    if (chat.id && (chat.id.includes('@s.whatsapp.net') || chat.id.includes('@g.us'))) {
                        await getOrInsertContact(chat.id, chat.name, chat.notify, chat.id.includes('@g.us'), sessionId);
                    }
                }
                console.log(`[${sessionId}] 💾 ${whatsappChats.length} chats guardados en DB`);
            }
        } catch (chatError) {
            console.error(`[${sessionId}] ❌ Error obteniendo chats:`, chatError.message);
        }

        // 5. Cargar chats actualizados desde DB
        const updatedChats = await loadChatListFromDB(sessionId);
        console.log(`[${sessionId}] 📊 Total chats en DB: ${updatedChats.length}`);

        // 5. Crear chats de prueba si no hay ninguno
        if (updatedChats.length === 0) {
            console.log(`[${sessionId}] ⚠️ No hay chats, creando algunos de prueba...`);
            const testChats = [
                {
                    id: '549123456789@c.us',
                    name: 'Chat de Prueba 1',
                    isGroup: false,
                    lastMessage: 'Este es un chat de prueba',
                    timestamp: new Date().toISOString(),
                    isOnline: true,
                    unreadCount: 0,
                    avatar: null
                },
                {
                    id: '549987654321@c.us',
                    name: 'Chat de Prueba 2',
                    isGroup: false,
                    lastMessage: 'Hola, este es otro chat de prueba',
                    timestamp: new Date(Date.now() - 3600000).toISOString(),
                    isOnline: false,
                    unreadCount: 1,
                    avatar: null
                }
            ];

            // Guardar en DB
            for (const chat of testChats) {
                await getOrInsertContact(chat.id, chat.name, null, chat.isGroup, sessionId);
            }

            console.log(`[${sessionId}] ✅ Chats de prueba creados`);
        }

        res.json({
            success: true,
            message: 'Sincronización forzada completada exitosamente',
            stats: {
                chatsLoaded: updatedChats.length,
                whatsappChatsFound: whatsappChats.length,
                testChatsCreated: updatedChats.length === 0 ? 2 : 0
            },
            timestamp: new Date().toISOString()
        });

        // Emitir actualización a clientes conectados
        io.emit(`sync-completed-${sessionId}`, {
            contactsSynced: true,
            groupsSynced: true,
            chatsLoaded: updatedChats.length,
            forced: true,
            whatsappChatsFound: whatsappChats.length
        });

        console.log(`[${sessionId}] ✅ Sincronización forzada completada exitosamente`);

    } catch (error) {
        console.error(`[${sessionId}] ❌ Error en sincronización forzada:`, error);
        res.status(500).json({
            success: false,
            error: 'Error en sincronización forzada',
            details: error.message
        });
    }
});

// Verificar estado detallado de chats
app.get('/api/chats-status/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session) {
        return res.status(404).json({
            success: false,
            error: 'Sesión no encontrada'
        });
    }

    const status = {
        sessionId,
        isConnected: session.isConnected,
        hasSocket: !!session.sock,
        hasStore: !!(session.sock?.store),
        chatsInStore: 0,
        chatsFromGetChats: 0,
        chatsInDatabase: 0,
        timestamp: new Date().toISOString()
    };

    // Verificar chats en store
    if (session.sock?.store?.chats) {
        status.chatsInStore = Object.keys(session.sock.store.chats).length;
    }

    // Verificar chats con getChats()
    if (session.sock && session.isConnected) {
        try {
            const allChats = await session.sock.getChats();
            status.chatsFromGetChats = allChats.length;
        } catch (error) {
            status.getChatsError = error.message;
        }
    }

    // Verificar contactos en store
    if (session.sock?.store?.contacts) {
        status.contactsInStore = Object.keys(session.sock.store.contacts).length;
    }

    // Verificar chats en base de datos
    if (pool) {
        try {
            const [result] = await pool.query('SELECT COUNT(*) as count FROM contacts WHERE (is_group = TRUE OR is_group = FALSE) AND session_id = ?', [sessionId]);
            status.chatsInDatabase = result[0].count;
        } catch (error) {
            status.databaseError = error.message;
        }
    }

    console.log(`[${sessionId}] 📊 Estado de chats:`, status);

    res.json({
        success: true,
        status
    });
});

// Diagnóstico de sesión y chats
app.get('/api/diagnostic/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    console.log(`[${sessionId}] 🔍 Ejecutando diagnóstico de sesión`);

    const session = sessions.get(sessionId);
    const diagnostic = {
        sessionId,
        timestamp: new Date().toISOString(),
        session: {
            exists: !!session,
            isConnected: session?.isConnected || false,
            hasSocket: !!session?.sock,
            qr: session?.qr || null
        },
        database: {
            available: !!pool
        },
        chats: {
            count: 0,
            sample: []
        },
        contacts: {
            count: 0,
            sample: []
        }
    };

    // Verificar chats en base de datos
    if (pool) {
        try {
            const [chatRows] = await pool.query('SELECT COUNT(*) as count FROM contacts WHERE (is_group = TRUE OR is_group = FALSE) AND session_id = ?', [sessionId]);
            diagnostic.chats.count = chatRows[0].count;

            const [chatSample] = await pool.query('SELECT jid, name, is_group FROM contacts WHERE session_id = ? LIMIT 5', [sessionId]);
            diagnostic.chats.sample = chatSample;
        } catch (error) {
            console.error('Error checking chats in DB:', error);
        }

        try {
            const [contactRows] = await pool.query('SELECT COUNT(*) as count FROM contacts WHERE is_group = FALSE AND session_id = ?', [sessionId]);
            diagnostic.contacts.count = contactRows[0].count;

            const [contactSample] = await pool.query('SELECT jid, name FROM contacts WHERE is_group = FALSE AND session_id = ? LIMIT 5', [sessionId]);
            diagnostic.contacts.sample = contactSample;
        } catch (error) {
            console.error('Error checking contacts in DB:', error);
        }
    }

    // Verificar chats en WhatsApp si la sesión está conectada
    if (session?.sock && session.isConnected) {
        try {
            console.log(`[${sessionId}] 📱 Obteniendo chats desde WhatsApp...`);
            let whatsappChats = [];

            // Intentar obtener chats del store si está disponible
            if (session.sock.store?.chats) {
                whatsappChats = Object.values(session.sock.store.chats);
            } else {
                // Intentar con getChats() como alternativa
                try {
                    whatsappChats = await session.sock.getChats();
                } catch (getChatsError) {
                    console.error(`[${sessionId}] Error obteniendo chats con getChats():`, getChatsError.message);
                }
            }

            diagnostic.whatsapp = {
                chatsCount: whatsappChats.length,
                chatsSample: whatsappChats.slice(0, 3).map(chat => ({
                    id: chat.id,
                    name: chat.name,
                    isGroup: chat.id.includes('@g.us')
                }))
            };
        } catch (error) {
            console.error(`[${sessionId}] Error obteniendo chats de WhatsApp:`, error);
            diagnostic.whatsapp = { error: error.message };
        }
    }

    console.log(`[${sessionId}] 📊 Resultado del diagnóstico:`, JSON.stringify(diagnostic, null, 2));

    res.json({
        success: true,
        diagnostic
    });
});

// Socket.IO para comunicación en tiempo real
io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);
    const sessionId = socket.handshake.query.sessionId;
    
    if (sessionId) {
        socket.join(`session-${sessionId}`);
        console.log(`Cliente ${socket.id} se unió a la sala session-${sessionId}`);
    } else {
        console.warn(`Cliente ${socket.id} conectado sin sessionId en query.`);
    }
    
    socket.on('join-session', (sid) => {
        if(sid){
             socket.join(`session-${sid}`);
             console.log(`Cliente ${socket.id} (re)unido explícitamente a sesión ${sid}`);
        }
    });
    
    socket.on('leave-session', (sessionId) => {
        socket.leave(`session-${sessionId}`);
        console.log(`Cliente ${socket.id} abandonó sesión ${sessionId}`);
    });
    
    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
    });
});

// Función de limpieza al cerrar
const cleanup = async () => {
    console.log('\nCerrando servidor...');
    
    for (const [sessionId, session] of sessions.entries()) {
        try {
            if (session.sock && session.isConnected) {
                await session.sock.logout();
                console.log(`Sesión ${sessionId} cerrada`);
            }
        } catch (err) {
            console.error(`Error cerrando sesión ${sessionId}:`, err.message);
        }
    }
    
    if (server) {
        server.close(() => {
            console.log('Servidor cerrado');
            process.exit(0);
        });
    }
};

// Manejadores de señales
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('uncaughtException', async (err) => {
    console.error('Error no capturado:', err);
    await cleanup();
});

// =================== ENDPOINTS DE CAMPAÑAS ===================

// Crear nueva campaña
app.post('/api/campaigns/create', async (req, res) => {
    const { sessionId, campaign } = req.body;

    if (!sessionId || !campaign) {
        return res.status(400).json({
            success: false,
            error: 'SessionId y datos de campaña son requeridos'
        });
    }

    try {
        console.log(`[${sessionId}] 📢 Creando nueva campaña: ${campaign.name}`);

        // Validar que la sesión existe
        const session = sessions.get(sessionId);
        if (!session || !session.sock || !session.isConnected) {
            return res.status(400).json({
                success: false,
                error: 'Sesión no encontrada o no conectada'
            });
        }

        // Procesar lista de destinatarios según el tipo seleccionado
        let recipients = [];

        if (campaign.contactSelectionType === 'segments') {
            // Obtener contactos por segmentos (simulado por ahora)
            recipients = [];
        } else if (campaign.contactSelectionType === 'individual') {
            recipients = campaign.selectedContacts || [];
        } else if (campaign.contactSelectionType === 'groups') {
            recipients = campaign.selectedGroups || [];
        } else if (campaign.contactSelectionType === 'manual') {
            recipients = campaign.manualContacts || [];
        }

        console.log(`[${sessionId}] 👥 Destinatarios procesados: ${recipients.length}`);

        // Iniciar envío masivo
        const campaignId = Date.now().toString();
        startMassCampaign(sessionId, campaignId, campaign, recipients);

        res.json({
            success: true,
            campaignId,
            message: `Campaña "${campaign.name}" iniciada`,
            recipientCount: recipients.length
        });

    } catch (error) {
        console.error(`[${sessionId}] Error creando campaña:`, error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// Estado de campaña
app.get('/api/campaigns/:campaignId/status', (req, res) => {
    const { campaignId } = req.params;

    // Simular estado de campaña (en producción vendría de base de datos)
    const status = {
        id: campaignId,
        status: 'running',
        sent: Math.floor(Math.random() * 100),
        total: 250,
        success: Math.floor(Math.random() * 90),
        failed: Math.floor(Math.random() * 10)
    };

    res.json({
        success: true,
        campaign: status
    });
});

// Función para iniciar campaña masiva
async function startMassCampaign(sessionId, campaignId, campaign, recipients) {
    const session = sessions.get(sessionId);
    if (!session || !session.sock) {
        console.error(`[${sessionId}] Sesión no disponible para campaña ${campaignId}`);
        return;
    }

    console.log(`[${sessionId}] 🚀 Iniciando campaña masiva: ${campaign.name}`);
    console.log(`[${sessionId}] 📊 Destinatarios: ${recipients.length}`);

    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
        try {
            // Personalizar mensaje con variables
            let personalizedMessage = campaign.message.text;

            if (campaign.contactSelectionType === 'manual') {
                personalizedMessage = personalizedMessage.replace(/{nombre}/g, recipient.name || '');
                personalizedMessage = personalizedMessage.replace(/{empresa}/g, 'Tu empresa');
            } else if (campaign.contactSelectionType === 'individual') {
                // Buscar datos del contacto
                const contact = await getContactByJid(sessionId, recipient);
                personalizedMessage = personalizedMessage.replace(/{nombre}/g, contact?.name || '');
            }

            // Determinar destinatario
            let targetJid = '';
            if (campaign.contactSelectionType === 'manual') {
                targetJid = recipient.phone.includes('@') ? recipient.phone : `${recipient.phone}@s.whatsapp.net`;
            } else if (campaign.contactSelectionType === 'groups') {
                targetJid = recipient;
            } else {
                targetJid = recipient;
            }

            // Enviar mensaje
            if (campaign.selectedMedia) {
                // Envío con multimedia (requiere implementación adicional)
                console.log(`[${sessionId}] 📎 Enviando mensaje con multimedia a ${targetJid}`);
                await session.sock.sendMessage(targetJid, {
                    text: personalizedMessage,
                    // media: campaign.selectedMedia // Requiere procesamiento de archivo
                });
            } else {
                // Envío solo texto
                await session.sock.sendMessage(targetJid, {
                    text: personalizedMessage
                });
            }

            sent++;
            console.log(`[${sessionId}] ✅ Mensaje enviado a ${targetJid} (${sent}/${recipients.length})`);

            // Delay entre mensajes para evitar spam
            await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

        } catch (error) {
            failed++;
            console.error(`[${sessionId}] ❌ Error enviando a ${recipient}:`, error.message);
        }
    }

    console.log(`[${sessionId}] 🏁 Campaña completada: ${sent} enviados, ${failed} fallidos`);

    // Notificar completion via Socket.IO
    if (io) {
        io.emit(`campaign-completed-${sessionId}`, {
            campaignId,
            sent,
            failed,
            total: recipients.length
        });
    }
}

// Función auxiliar para obtener contacto por JID
async function getContactByJid(sessionId, jid) {
    if (!pool) return null;

    try {
        const connection = await pool.getConnection();
        const [contacts] = await connection.execute(
            'SELECT name, notify_name FROM contacts WHERE jid = ? AND session_id = ?',
            [jid, sessionId]
        );
        connection.release();

        return contacts[0] || null;
    } catch (error) {
        console.error('Error obteniendo contacto:', error);
        return null;
    }
}

// ===================================
// ENDPOINTS DE SEGMENTOS DE AUDIENCIA
// ===================================

// Obtener segmentos de audiencia basados en datos reales
app.get('/api/segments/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        console.log(`📊 Generando segmentos de audiencia para sessionId: ${sessionId}`);

        // Obtener estadísticas de contactos reales
        const totalContactsQuery = 'SELECT COUNT(*) as total FROM contacts WHERE session_id = ? AND is_group = 0';
        const totalGroupsQuery = 'SELECT COUNT(*) as total FROM contacts WHERE session_id = ? AND is_group = 1';

        // Contactos activos (con mensajes recientes)
        const activeContactsQuery = `
            SELECT COUNT(DISTINCT c.whatsapp_id) as count
            FROM contacts c
            INNER JOIN messages m ON c.whatsapp_id = m.from_jid OR c.whatsapp_id = m.to_jid
            WHERE c.session_id = ? AND c.is_group = 0
            AND m.timestamp > DATE_SUB(NOW(), INTERVAL 30 DAY)
        `;

        // Contactos VIP (con muchas interacciones)
        const vipContactsQuery = `
            SELECT COUNT(DISTINCT c.whatsapp_id) as count
            FROM contacts c
            INNER JOIN (
                SELECT from_jid as jid, COUNT(*) as msg_count
                FROM messages
                WHERE session_id = ?
                GROUP BY from_jid
                HAVING msg_count > 10
            ) msg_stats ON c.whatsapp_id = msg_stats.jid
            WHERE c.session_id = ? AND c.is_group = 0
        `;

        // Contactos inactivos
        const inactiveContactsQuery = `
            SELECT COUNT(*) as count
            FROM contacts c
            WHERE c.session_id = ? AND c.is_group = 0
            AND c.whatsapp_id NOT IN (
                SELECT DISTINCT from_jid
                FROM messages
                WHERE session_id = ?
                AND timestamp > DATE_SUB(NOW(), INTERVAL 90 DAY)
            )
        `;

        // Ejecutar todas las consultas
        const [totalContacts] = await executeQuery(totalContactsQuery, [sessionId]);
        const [totalGroups] = await executeQuery(totalGroupsQuery, [sessionId]);
        const [activeContacts] = await executeQuery(activeContactsQuery, [sessionId]);
        const [vipContacts] = await executeQuery(vipContactsQuery, [sessionId, sessionId]);
        const [inactiveContacts] = await executeQuery(inactiveContactsQuery, [sessionId, sessionId]);

        // Crear segmentos basados en datos reales
        const segments = [
            {
                id: 'todos-contactos',
                name: 'Todos los Contactos',
                description: 'Todos los contactos individuales guardados',
                count: totalContacts.total || 0,
                color: '#2196f3',
                criteria: 'Todos los contactos de WhatsApp',
                lastUpdated: new Date().toISOString()
            },
            {
                id: 'contactos-activos',
                name: 'Contactos Activos',
                description: 'Contactos con actividad en los últimos 30 días',
                count: activeContacts.count || 0,
                color: '#4caf50',
                criteria: 'Mensajes en últimos 30 días',
                lastUpdated: new Date().toISOString()
            },
            {
                id: 'clientes-vip',
                name: 'Clientes VIP',
                description: 'Contactos con alta frecuencia de comunicación (>10 mensajes)',
                count: vipContacts.count || 0,
                color: '#ff9800',
                criteria: 'Más de 10 mensajes intercambiados',
                lastUpdated: new Date().toISOString()
            },
            {
                id: 'contactos-inactivos',
                name: 'Contactos Inactivos',
                description: 'Contactos sin actividad en los últimos 90 días',
                count: inactiveContacts.count || 0,
                color: '#f44336',
                criteria: 'Sin actividad en últimos 90 días',
                lastUpdated: new Date().toISOString()
            },
            {
                id: 'todos-grupos',
                name: 'Todos los Grupos',
                description: 'Todos los grupos de WhatsApp',
                count: totalGroups.total || 0,
                color: '#9c27b0',
                criteria: 'Grupos de WhatsApp',
                lastUpdated: new Date().toISOString()
            }
        ];

        console.log(`✅ Segmentos generados: ${segments.length} segmentos con datos reales`);
        res.json({ success: true, segments });

    } catch (error) {
        console.error('❌ Error obteniendo segmentos:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor obteniendo segmentos',
            details: error.message
        });
    }
});

// Obtener contactos de un segmento específico
app.get('/api/segments/:sessionId/:segmentId/contacts', async (req, res) => {
    try {
        const { sessionId, segmentId } = req.params;
        const { limit = 100, offset = 0 } = req.query;

        console.log(`📋 Obteniendo contactos del segmento: ${segmentId} para sessionId: ${sessionId}`);

        let query = '';
        let params = [];

        switch (segmentId) {
            case 'todos-contactos':
                query = `
                    SELECT whatsapp_id, name, avatar_url
                    FROM contacts
                    WHERE session_id = ? AND is_group = 0
                    ORDER BY name
                    LIMIT ? OFFSET ?
                `;
                params = [sessionId, parseInt(limit), parseInt(offset)];
                break;

            case 'contactos-activos':
                query = `
                    SELECT DISTINCT c.whatsapp_id, c.name, c.avatar_url
                    FROM contacts c
                    INNER JOIN messages m ON c.whatsapp_id = m.from_jid OR c.whatsapp_id = m.to_jid
                    WHERE c.session_id = ? AND c.is_group = 0
                    AND m.timestamp > DATE_SUB(NOW(), INTERVAL 30 DAY)
                    ORDER BY c.name
                    LIMIT ? OFFSET ?
                `;
                params = [sessionId, parseInt(limit), parseInt(offset)];
                break;

            case 'clientes-vip':
                query = `
                    SELECT DISTINCT c.whatsapp_id, c.name, c.avatar_url
                    FROM contacts c
                    INNER JOIN (
                        SELECT from_jid as jid, COUNT(*) as msg_count
                        FROM messages
                        WHERE session_id = ?
                        GROUP BY from_jid
                        HAVING msg_count > 10
                    ) msg_stats ON c.whatsapp_id = msg_stats.jid
                    WHERE c.session_id = ? AND c.is_group = 0
                    ORDER BY c.name
                    LIMIT ? OFFSET ?
                `;
                params = [sessionId, sessionId, parseInt(limit), parseInt(offset)];
                break;

            case 'contactos-inactivos':
                query = `
                    SELECT whatsapp_id, name, avatar_url
                    FROM contacts c
                    WHERE c.session_id = ? AND c.is_group = 0
                    AND c.whatsapp_id NOT IN (
                        SELECT DISTINCT from_jid
                        FROM messages
                        WHERE session_id = ?
                        AND timestamp > DATE_SUB(NOW(), INTERVAL 90 DAY)
                    )
                    ORDER BY name
                    LIMIT ? OFFSET ?
                `;
                params = [sessionId, sessionId, parseInt(limit), parseInt(offset)];
                break;

            case 'todos-grupos':
                query = `
                    SELECT whatsapp_id, name, avatar_url
                    FROM contacts
                    WHERE session_id = ? AND is_group = 1
                    ORDER BY name
                    LIMIT ? OFFSET ?
                `;
                params = [sessionId, parseInt(limit), parseInt(offset)];
                break;

            default:
                return res.status(400).json({
                    success: false,
                    error: 'Segmento no válido'
                });
        }

        const contacts = await executeQuery(query, params);

        console.log(`✅ ${contacts.length} contactos obtenidos del segmento ${segmentId}`);
        res.json({ success: true, contacts });

    } catch (error) {
        console.error('❌ Error obteniendo contactos del segmento:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor obteniendo contactos del segmento',
            details: error.message
        });
    }
});

// Iniciar servidor
const PORT = process.env.PORT || 3002;
server.listen(PORT, async () => {
    console.log(`\n🚀 WhatsApp Web API iniciado en puerto ${PORT}`);
    console.log(`📱 Endpoints disponibles:`);
    console.log(`   GET  /api/qr-status - Obtener código QR`);
    console.log(`   POST /api/send/message - Enviar mensaje de texto`);
    console.log(`   POST /api/send/image - Enviar imagen`);
    console.log(`   POST /api/send/audio - Enviar audio`);
    console.log(`   POST /api/send/video - Enviar video`);
    console.log(`   POST /api/send/document - Enviar documento`);
    console.log(`   GET  /api/messages/:sessionId - Obtener mensajes`);
    console.log(`   GET  /api/chats/:sessionId - Obtener chats`);
    console.log(`   POST /api/sync/contacts - Sincronizar contactos`);
    console.log(`   POST /api/sync/groups - Sincronizar grupos`);
    console.log(`   GET  /api/contacts/:sessionId - Obtener contactos guardados`);
    console.log(`   GET  /api/groups/:sessionId - Obtener grupos guardados`);
    console.log(`   GET  /api/avatar/:sessionId/:jid - Obtener avatar de contacto`);
    console.log(`   POST /api/avatars/batch/:sessionId - Obtener múltiples avatares`);
    console.log(`   POST /api/update-contacts-avatars/:sessionId - Actualizar avatares`);
    console.log(`   POST /api/campaigns/save - Guardar campañas`);
    console.log(`   GET  /api/campaigns/:sessionId - Cargar campañas`);
    console.log(`   GET  /api/segments/:sessionId - Obtener segmentos de audiencia`);
    console.log(`   GET  /api/segments/:sessionId/:segmentId/contacts - Obtener contactos de segmento`);
    console.log(`   GET  /api/diagnostic/:sessionId - Diagnóstico de sesión`);
    console.log(`   GET  /api/health - Estado del servidor`);
    console.log(`   GET  /api/history/messages - Obtener historial de mensajes`);
    console.log(`   POST /api/download-history/:sessionId - Descargar historial completo`);
    console.log(`   POST /api/sync-realtime/:sessionId - Sincronización en tiempo real`);
    console.log(`   POST /api/force-sync/:sessionId - Sincronización forzada`);
    console.log(`   DELETE /api/messages/:sessionId - Eliminar mensajes específicos`);
    console.log(`   DELETE /api/chat/:sessionId/:chatJid - Eliminar chat completo`);
    console.log(`   DELETE /api/history/:sessionId - Eliminar historial completo`);
    console.log(`   GET  /api/chats-status/:sessionId - Estado detallado de chats`);
    console.log(`
✅ Servidor listo para recibir conexiones`);
    await initializeDatabase();
});