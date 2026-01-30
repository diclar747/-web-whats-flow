/**
 * Analytics Endpoints
 * 
 * Provides comprehensive analytics data for:
 * - Messages (sent, received, delivered, read, failed)
 * - Campaigns (active, scheduled, effectiveness)
 * - Agents (performance, activity, status)
 * - Kanban (boards, contacts, conversion)
 * - General dashboard (KPIs, alerts)
 */

const express = require('express');

module.exports = function (app, pool) {
    console.log('[ANALYTICS] Initializing analytics endpoints...');

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    /**
     * Get date range from query params or default to last 30 days
     */
    function getDateRange(req) {
        const endDate = req.query.endDate || new Date().toISOString().split('T')[0];
        const startDate = req.query.startDate ||
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        return { startDate, endDate };
    }

    /**
     * Calculate percentage safely
     */
    function calculatePercentage(numerator, denominator) {
        if (!denominator || denominator === 0) return 0;
        return Math.round((numerator / denominator) * 100 * 100) / 100;
    }

    /**
     * Helper to get phone number from session ID
     */
    async function getPhoneNumber(sessionId) {
        if (!pool) return sessionId;
        try {
            // Check if sessionId is already a phone number
            if (/^\+?\d{10,15}$/.test(sessionId)) {
                return sessionId.replace(/\+/g, '');
            }

            // Check if sessionId is a User ID (small number)
            if (!isNaN(sessionId) && parseInt(sessionId) < 1000000) {
                const [userRows] = await pool.query(
                    'SELECT phone FROM users WHERE id = ? LIMIT 1',
                    [sessionId]
                );
                if (userRows.length > 0 && userRows[0].phone) {
                    return userRows[0].phone;
                }
            }

            // Query user_sessions
            const [rows] = await pool.query(
                'SELECT phone FROM user_sessions WHERE session_id = ? LIMIT 1',
                [sessionId]
            );

            if (rows.length > 0 && rows[0].phone) {
                return rows[0].phone;
            }
            return sessionId; // Fallback
        } catch (error) {
            console.error('[ANALYTICS] Error resolving phone number:', error);
            return sessionId;
        }
    }

    // ============================================
    // MESSAGE ANALYTICS ENDPOINTS
    // ============================================

    /**
     * GET /api/analytics/messages/overview
     * Returns overall message statistics
     */
    app.get('/api/analytics/messages/overview', async (req, res) => {
        res.header('Cache-Control', 'no-store');
        try {
            const sessionId = req.query.sessionId;
            const { startDate, endDate } = getDateRange(req);

            if (!sessionId) {
                return res.status(400).json({ error: 'sessionId is required' });
            }

            const phoneNumber = await getPhoneNumber(sessionId);
            console.log(`[ANALYTICS-OVERVIEW] Resolved ${sessionId} -> ${phoneNumber}`);

            const query = `
                SELECT 
                    COUNT(*) as total_messages,
                    SUM(CASE WHEN from_me = 1 THEN 1 ELSE 0 END) as total_sent,
                    SUM(CASE WHEN from_me = 0 THEN 1 ELSE 0 END) as total_received,
                    SUM(CASE WHEN status = 'delivered' OR status = 'read' THEN 1 ELSE 0 END) as total_delivered,
                    SUM(CASE WHEN is_read = 1 THEN 1 ELSE 0 END) as total_read,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as total_pending
                FROM messages
                WHERE phone = ?
                AND DATE(timestamp) BETWEEN ? AND ?
            `;

            const [results] = await pool.query(query, [phoneNumber, startDate, endDate]);
            const data = results[0];

            // Calculate rates
            const deliveryRate = calculatePercentage(data.total_delivered, data.total_sent);
            const readRate = calculatePercentage(data.total_read, data.total_sent);
            const responseRate = calculatePercentage(data.total_received, data.total_sent);

            res.json({
                success: true,
                data: {
                    ...data,
                    delivery_rate: deliveryRate,
                    read_rate: readRate,
                    response_rate: responseRate,
                    period: { startDate, endDate }
                }
            });

        } catch (error) {
            console.error('[ANALYTICS] Error in messages/overview:', error);
            res.status(500).json({ error: 'Failed to fetch message overview' });
        }
    });

    /**
     * GET /api/analytics/messages/by-type
     * Returns message breakdown by type
     */
    app.get('/api/analytics/messages/by-type', async (req, res) => {
        try {
            const sessionId = req.query.sessionId;
            const { startDate, endDate } = getDateRange(req);

            if (!sessionId) {
                return res.status(400).json({ error: 'sessionId is required' });
            }

            const phoneNumber = await getPhoneNumber(sessionId);

            const query = `
                SELECT 
                    message_type,
                    COUNT(*) as count
                FROM messages
                WHERE phone = ?
                AND DATE(timestamp) BETWEEN ? AND ?
                GROUP BY message_type
                ORDER BY count DESC
            `;

            const [results] = await pool.query(query, [phoneNumber, startDate, endDate]);

            res.json({
                success: true,
                data: results,
                period: { startDate, endDate }
            });

        } catch (error) {
            console.error('[ANALYTICS] Error in messages/by-type:', error);
            res.status(500).json({ error: 'Failed to fetch message types' });
        }
    });

    /**
     * GET /api/analytics/messages/timeline
     * Returns daily message counts for charts
     */
    app.get('/api/analytics/messages/timeline', async (req, res) => {
        try {
            const sessionId = req.query.sessionId;
            const { startDate, endDate } = getDateRange(req);

            if (!sessionId) {
                return res.status(400).json({ error: 'sessionId is required' });
            }

            const phoneNumber = await getPhoneNumber(sessionId);

            const query = `
                SELECT 
                    DATE(timestamp) as date,
                    COUNT(*) as total,
                    SUM(CASE WHEN from_me = 1 THEN 1 ELSE 0 END) as sent,
                    SUM(CASE WHEN from_me = 0 THEN 1 ELSE 0 END) as received,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
                FROM messages
                WHERE phone = ?
                AND DATE(timestamp) BETWEEN ? AND ?
                GROUP BY DATE(timestamp)
                ORDER BY date ASC
            `;

            const [results] = await pool.query(query, [phoneNumber, startDate, endDate]);

            res.json({
                success: true,
                data: results,
                period: { startDate, endDate }
            });

        } catch (error) {
            console.error('[ANALYTICS] Error in messages/timeline:', error);
            res.status(500).json({ error: 'Failed to fetch message timeline' });
        }
    });

    /**
     * GET /api/analytics/messages/by-agent
     * Returns message counts per agent
     */
    app.get('/api/analytics/messages/by-agent', async (req, res) => {
        try {
            const sessionId = req.query.sessionId;
            const { startDate, endDate } = getDateRange(req);

            if (!sessionId) {
                return res.status(400).json({ error: 'sessionId is required' });
            }

            const phoneNumber = await getPhoneNumber(sessionId);

            const query = `
                SELECT 
                    m.agent_id,
                    m.agent_name,
                    COUNT(*) as total_messages,
                    SUM(CASE WHEN m.from_me = 1 THEN 1 ELSE 0 END) as sent,
                    SUM(CASE WHEN m.from_me = 0 THEN 1 ELSE 0 END) as received
                FROM messages m
                WHERE m.phone = ?
                AND m.agent_id IS NOT NULL
                AND DATE(m.timestamp) BETWEEN ? AND ?
                GROUP BY m.agent_id, m.agent_name
                ORDER BY total_messages DESC
            `;

            const [results] = await pool.query(query, [phoneNumber, startDate, endDate]);

            res.json({
                success: true,
                data: results,
                period: { startDate, endDate }
            });

        } catch (error) {
            console.error('[ANALYTICS] Error in messages/by-agent:', error);
            res.status(500).json({ error: 'Failed to fetch messages by agent' });
        }
    });

    /**
     * GET /api/analytics/messages/performance
     * Returns performance metrics (messages/hour, peak times)
     */
    app.get('/api/analytics/messages/performance', async (req, res) => {
        try {
            const sessionId = req.query.sessionId;
            const { startDate, endDate } = getDateRange(req);

            if (!sessionId) {
                return res.status(400).json({ error: 'sessionId is required' });
            }

            // Get hourly distribution
            const phoneNumber = await getPhoneNumber(sessionId);

            const hourlyQuery = `
                SELECT 
                    HOUR(timestamp) as hour,
                    COUNT(*) as count
                FROM messages
                WHERE phone = ?
                AND DATE(timestamp) BETWEEN ? AND ?
                GROUP BY HOUR(timestamp)
                ORDER BY hour ASC
            `;

            const [hourlyResults] = await pool.query(hourlyQuery, [phoneNumber, startDate, endDate]);

            // Calculate messages per hour average
            const totalMessages = hourlyResults.reduce((sum, row) => sum + row.count, 0);
            const totalHours = hourlyResults.length || 1;
            const messagesPerHour = Math.round(totalMessages / totalHours);

            // Find peak hour
            const peakHour = hourlyResults.reduce((max, row) =>
                row.count > max.count ? row : max,
                { hour: 0, count: 0 }
            );

            res.json({
                success: true,
                data: {
                    messages_per_hour: messagesPerHour,
                    peak_hour: peakHour.hour,
                    peak_hour_count: peakHour.count,
                    hourly_distribution: hourlyResults
                },
                period: { startDate, endDate }
            });

        } catch (error) {
            console.error('[ANALYTICS] Error in messages/performance:', error);
            res.status(500).json({ error: 'Failed to fetch message performance' });
        }
    });

    // ============================================
    // CAMPAIGN ANALYTICS ENDPOINTS
    // ============================================

    /**
     * GET /api/analytics/campaigns/overview
     * Returns campaign statistics
     */
    app.get('/api/analytics/campaigns/overview', async (req, res) => {
        try {
            const sessionId = req.query.sessionId;

            if (!sessionId) {
                return res.status(400).json({ error: 'sessionId is required' });
            }

            const query = `
                SELECT 
                    COUNT(*) as total_campaigns,
                    SUM(CASE WHEN status = 'active' OR status = 'running' THEN 1 ELSE 0 END) as active_campaigns,
                    SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled_campaigns,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_campaigns,
                    SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_campaigns
                FROM campaigns
                WHERE session_id = ?
            `;

            const [results] = await pool.query(query, [sessionId]);

            res.json({
                success: true,
                data: results[0]
            });

        } catch (error) {
            console.error('[ANALYTICS] Error in campaigns/overview:', error);
            res.status(500).json({ error: 'Failed to fetch campaign overview' });
        }
    });

    /**
     * GET /api/analytics/campaigns/effectiveness
     * Returns campaign effectiveness metrics
     */
    app.get('/api/analytics/campaigns/effectiveness', async (req, res) => {
        try {
            const sessionId = req.query.sessionId;
            const { startDate, endDate } = getDateRange(req);

            if (!sessionId) {
                return res.status(400).json({ error: 'sessionId is required' });
            }

            const query = `
                SELECT 
                    c.id,
                    c.name,
                    c.status,
                    COUNT(cr.id) as total_recipients,
                    SUM(CASE WHEN cr.status IN ('sent', 'delivered', 'read') THEN 1 ELSE 0 END) as sent,
                    SUM(CASE WHEN cr.status IN ('delivered', 'read') THEN 1 ELSE 0 END) as delivered,
                    SUM(CASE WHEN cr.status = 'read' THEN 1 ELSE 0 END) as \`read\`,
                    SUM(CASE WHEN cr.status = 'failed' THEN 1 ELSE 0 END) as failed
                FROM campaigns c
                LEFT JOIN campaign_recipients cr ON c.id = cr.campaign_id
                WHERE c.session_id = ?
                AND DATE(c.created_at) BETWEEN ? AND ?
                GROUP BY c.id
                ORDER BY c.created_at DESC
                LIMIT 20
            `;

            const [results] = await pool.query(query, [sessionId, startDate, endDate]);

            // Calculate effectiveness for each campaign
            const campaignsWithMetrics = results.map(campaign => {
                const deliveryRate = calculatePercentage(campaign.delivered, campaign.total_recipients);
                const readRate = calculatePercentage(campaign.read, campaign.total_recipients);
                const effectivenessScore = Math.round((deliveryRate + readRate) / 2);

                return {
                    ...campaign,
                    delivery_rate: deliveryRate,
                    read_rate: readRate,
                    effectiveness_score: effectivenessScore
                };
            });

            res.json({
                success: true,
                data: campaignsWithMetrics,
                period: { startDate, endDate }
            });

        } catch (error) {
            console.error('[ANALYTICS] Error in campaigns/effectiveness:', error);
            res.status(500).json({ error: 'Failed to fetch campaign effectiveness' });
        }
    });

    /**
     * GET /api/analytics/campaigns/timeline
     * Returns campaign creation over time
     */
    app.get('/api/analytics/campaigns/timeline', async (req, res) => {
        try {
            const sessionId = req.query.sessionId;
            const { startDate, endDate } = getDateRange(req);

            if (!sessionId) {
                return res.status(400).json({ error: 'sessionId is required' });
            }

            const query = `
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as count,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
                FROM campaigns
                WHERE session_id = ?
                AND DATE(created_at) BETWEEN ? AND ?
                GROUP BY DATE(created_at)
                ORDER BY date ASC
            `;

            const [results] = await pool.query(query, [sessionId, startDate, endDate]);

            res.json({
                success: true,
                data: results,
                period: { startDate, endDate }
            });

        } catch (error) {
            console.error('[ANALYTICS] Error in campaigns/timeline:', error);
            res.status(500).json({ error: 'Failed to fetch campaign timeline' });
        }
    });

    // ============================================
    // AGENT ANALYTICS ENDPOINTS
    // ============================================

    /**
     * GET /api/analytics/agents/overview
     * Returns agent statistics
     */
    app.get('/api/analytics/agents/overview', async (req, res) => {
        res.header('Cache-Control', 'no-store');
        try {
            const sessionId = req.query.sessionId;

            if (!sessionId) {
                return res.status(400).json({ error: 'sessionId is required' });
            }

            const query = `
                SELECT 
                    COUNT(*) as total_agents,
                    SUM(CASE WHEN agent_status = 'online' THEN 1 ELSE 0 END) as online_agents,
                    SUM(CASE WHEN agent_status = 'busy' THEN 1 ELSE 0 END) as busy_agents,
                    SUM(CASE WHEN agent_status = 'offline' OR agent_status IS NULL THEN 1 ELSE 0 END) as offline_agents,
                    SUM(CASE WHEN agent_status = 'paused' THEN 1 ELSE 0 END) as away_agents
                FROM users
                WHERE session_id = ?
                AND status = 'active'
                AND role IN ('agent', 'supervisor', 'admin')
            `;

            const [results] = await pool.query(query, [sessionId]);

            res.json({
                success: true,
                data: results[0]
            });

        } catch (error) {
            console.error('[ANALYTICS] Error in agents/overview:', error);
            res.status(500).json({ error: 'Failed to fetch agent overview' });
        }
    });

    /**
     * GET /api/analytics/agents/performance
     * Returns agent performance metrics
     */
    app.get('/api/analytics/agents/performance', async (req, res) => {
        try {
            const sessionId = req.query.sessionId;
            const { startDate, endDate } = getDateRange(req);

            if (!sessionId) {
                return res.status(400).json({ error: 'sessionId is required' });
            }

            const query = `
                SELECT 
                    a.id,
                    a.name,
                    a.agent_status as status,
                    a.email,
                    COUNT(DISTINCT ach.id) as total_conversations,
                    SUM(CASE WHEN ach.status = 'closed' THEN 1 ELSE 0 END) as conversations_closed,
                    SUM(ach.messages_count) as total_messages,
                    a.last_login as last_activity
                FROM users a
                LEFT JOIN agent_chat_history ach ON a.id = ach.agent_id
                    AND DATE(ach.assigned_at) BETWEEN ? AND ?
                WHERE a.session_id = ?
                AND a.status = 'active'
                AND a.role IN ('agent', 'supervisor')
                GROUP BY a.id
                ORDER BY total_conversations DESC
            `;

            const [results] = await pool.query(query, [startDate, endDate, sessionId]);

            // Calculate performance scores
            const agentsWithMetrics = results.map(agent => {
                const closeRate = calculatePercentage(agent.conversations_closed, agent.total_conversations);
                const avgMessagesPerConversation = agent.total_conversations > 0
                    ? Math.round(agent.total_messages / agent.total_conversations)
                    : 0;

                return {
                    ...agent,
                    close_rate: closeRate,
                    avg_messages_per_conversation: avgMessagesPerConversation
                };
            });

            res.json({
                success: true,
                data: agentsWithMetrics,
                period: { startDate, endDate }
            });

        } catch (error) {
            console.error('[ANALYTICS] Error in agents/performance:', error);
            res.status(500).json({ error: 'Failed to fetch agent performance' });
        }
    });

    /**
     * GET /api/analytics/agents/activity
     * Returns agent activity patterns
     */
    app.get('/api/analytics/agents/activity', async (req, res) => {
        try {
            const sessionId = req.query.sessionId;
            const { startDate, endDate } = getDateRange(req);

            if (!sessionId) {
                return res.status(400).json({ error: 'sessionId is required' });
            }

            const query = `
                SELECT 
                    DATE(ach.assigned_at) as date,
                    COUNT(DISTINCT ach.agent_id) as active_agents,
                    COUNT(ach.id) as total_assignments
                FROM agent_chat_history ach
                JOIN users a ON ach.agent_id = a.id
                WHERE a.session_id = ?
                AND a.role IN ('agent', 'supervisor')
                AND DATE(ach.assigned_at) BETWEEN ? AND ?
                GROUP BY DATE(ach.assigned_at)
                ORDER BY date ASC
            `;

            const [results] = await pool.query(query, [sessionId, startDate, endDate]);

            res.json({
                success: true,
                data: results,
                period: { startDate, endDate }
            });

        } catch (error) {
            console.error('[ANALYTICS] Error in agents/activity:', error);
            res.status(500).json({ error: 'Failed to fetch agent activity' });
        }
    });

    // ============================================
    // KANBAN ANALYTICS ENDPOINTS
    // ============================================

    /**
     * GET /api/analytics/kanban/overview
     * Returns kanban board statistics
     */
    app.get('/api/analytics/kanban/overview', async (req, res) => {
        try {
            const sessionId = req.query.sessionId;

            if (!sessionId) {
                return res.status(400).json({ error: 'sessionId is required' });
            }

            const query = `
                SELECT 
                    COUNT(DISTINCT kb.id) as total_boards,
                    COUNT(kc.id) as total_contacts
                FROM kanban_boards kb
                LEFT JOIN kanban_contacts kc ON kb.id = kc.board_id
                WHERE kb.session_id = ?
            `;

            const [results] = await pool.query(query, [sessionId]);

            res.json({
                success: true,
                data: results[0]
            });

        } catch (error) {
            console.error('[ANALYTICS] Error in kanban/overview:', error);
            res.status(500).json({ error: 'Failed to fetch kanban overview' });
        }
    });

    /**
     * GET /api/analytics/kanban/by-board
     * Returns metrics per kanban board
     */
    app.get('/api/analytics/kanban/by-board', async (req, res) => {
        try {
            const sessionId = req.query.sessionId;

            if (!sessionId) {
                return res.status(400).json({ error: 'sessionId is required' });
            }

            const query = `
                SELECT 
                    kb.id,
                    kb.name,
                    kb.color,
                    COUNT(kc.id) as total_contacts,
                    kb.created_at
                FROM kanban_boards kb
                LEFT JOIN kanban_contacts kc ON kb.id = kc.board_id
                WHERE kb.session_id = ?
                GROUP BY kb.id
                ORDER BY total_contacts DESC
            `;

            const [results] = await pool.query(query, [sessionId]);

            res.json({
                success: true,
                data: results
            });

        } catch (error) {
            console.error('[ANALYTICS] Error in kanban/by-board:', error);
            res.status(500).json({ error: 'Failed to fetch kanban by board' });
        }
    });

    // ============================================
    // GENERAL DASHBOARD ENDPOINT
    // ============================================

    /**
     * GET /api/analytics/dashboard
     * Returns combined KPIs and metrics for main dashboard
     */
    app.get('/api/analytics/dashboard', async (req, res) => {
        res.header('Cache-Control', 'no-store');
        try {
            let sessionId = req.query.sessionId;
            const { startDate, endDate } = getDateRange(req);

            if (!sessionId || !pool) {
                return res.json({
                    success: true,
                    data: {
                        messages: { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
                        deliveryRate: 0,
                        readRate: 0,
                        campaigns: { active: 0, total: 0 },
                        agents: { total: 0, online: 0 },
                        chatbots: 0,
                        kanbans: 0,
                        messagesFailed: 0,
                        failureRate: 0,
                        connections: 0
                    }
                });
            }

            const connection = await pool.getConnection();
            try {
                // 🔄 Resolver sessionId a user ID y phone
                let sessionIds = [sessionId];
                let phoneNumbers = [];

                // 🔒 VERIFICAR ROL DEL USUARIO PRIMERO
                const [userRows] = await connection.execute(
                    'SELECT id, phone, email, role, admin_phone FROM users WHERE email = ? OR phone = ? OR id = ? OR session_id = ? LIMIT 1',
                    [sessionId, sessionId, sessionId, sessionId]
                );

                let userRole = null;
                if (userRows.length > 0) {
                    const user = userRows[0];
                    userRole = user.role;
                    console.log(`[ANALYTICS-DASHBOARD] 👤 Usuario encontrado: id=${user.id}, phone=${user.phone}, role=${userRole}`);

                    // 🔒 Si es AGENTE, solo mostrar SUS datos
                    if (userRole === 'agent' || userRole === 'supervisor') {
                        sessionIds = [sessionId];
                        if (user.phone && !sessionIds.includes(user.phone)) sessionIds.push(user.phone);
                        if (user.id && !sessionIds.includes(String(user.id))) sessionIds.push(String(user.id));
                        if (user.phone) phoneNumbers.push(user.phone);
                        console.log(`[ANALYTICS-DASHBOARD] 🔒 Modo AGENTE: Solo datos propios - sessionIds: [${sessionIds.join(', ')}]`);
                    } else {
                        // Admin/Super_admin: Expandir a todas sus sesiones
                        if (!sessionIds.includes(String(user.id))) {
                            sessionIds.push(String(user.id));
                        }
                        if (user.phone && !phoneNumbers.includes(user.phone)) {
                            phoneNumbers.push(user.phone);
                        }

                        // Si el sessionId parece un teléfono, agregarlo a phoneNumbers
                        if (/^\d{10,15}$/.test(sessionId) && !phoneNumbers.includes(sessionId)) {
                            phoneNumbers.push(sessionId);
                        }

                        // Búsqueda adicional por owner_phone_number en user_sessions (solo para admins)
                        const [ownerRows] = await connection.execute(
                            'SELECT DISTINCT session_id, phone FROM user_sessions WHERE owner_phone_number = ? OR phone = ?',
                            [sessionId, sessionId]
                        );

                        for (const row of ownerRows) {
                            if (row.session_id && !sessionIds.includes(row.session_id)) {
                                sessionIds.push(row.session_id);
                            }
                            if (row.phone && !phoneNumbers.includes(row.phone)) {
                                phoneNumbers.push(row.phone);
                            }
                        }
                    }
                }

                console.log(`[ANALYTICS-DASHBOARD] 📋 SessionIds: [${sessionIds.join(', ')}], Phones: [${phoneNumbers.join(', ')}], Role: ${userRole}`);

                const sessionPlaceholders = sessionIds.map(() => '?').join(',');
                const phonePlaceholders = phoneNumbers.length > 0 ? phoneNumbers.map(() => '?').join(',') : null;

                // Messages stats - buscar por session_id O por phone
                const messageQuery = phonePlaceholders
                    ? `SELECT
                        COUNT(*) as total,
                        SUM(CASE WHEN from_me = 1 THEN 1 ELSE 0 END) as sent,
                        SUM(CASE WHEN from_me = 0 THEN 1 ELSE 0 END) as received,
                        SUM(CASE WHEN from_me = 1 AND status = 'delivered' THEN 1 ELSE 0 END) as delivered,
                        SUM(CASE WHEN from_me = 1 AND status = 'read' THEN 1 ELSE 0 END) as read_count,
                        SUM(CASE WHEN from_me = 1 AND status = 'failed' THEN 1 ELSE 0 END) as failed
                    FROM messages
                    WHERE session_id IN (${sessionPlaceholders}) OR phone IN (${phonePlaceholders})`
                    : `SELECT
                        COUNT(*) as total,
                        SUM(CASE WHEN from_me = 1 THEN 1 ELSE 0 END) as sent,
                        SUM(CASE WHEN from_me = 0 THEN 1 ELSE 0 END) as received,
                        SUM(CASE WHEN from_me = 1 AND status = 'delivered' THEN 1 ELSE 0 END) as delivered,
                        SUM(CASE WHEN from_me = 1 AND status = 'read' THEN 1 ELSE 0 END) as read_count,
                        SUM(CASE WHEN from_me = 1 AND status = 'failed' THEN 1 ELSE 0 END) as failed
                    FROM messages
                    WHERE session_id IN (${sessionPlaceholders})`;

                const messageParams = phonePlaceholders ? [...sessionIds, ...phoneNumbers] : sessionIds;
                const [messageStats] = await connection.execute(messageQuery, messageParams);
                const placeholders = sessionPlaceholders;

                const ms = messageStats[0] || {};
                const totalSent = ms.sent || 0;
                const delivered = ms.delivered || 0;
                const read = ms.read_count || 0;
                const failed = ms.failed || 0;

                const deliveryRate = totalSent > 0 ? ((delivered / totalSent) * 100) : 0;
                const readRate = totalSent > 0 ? ((read / totalSent) * 100) : 0;
                const failureRate = totalSent > 0 ? ((failed / totalSent) * 100) : 0;

                // Campaigns stats
                const [campaigns] = await connection.execute(
                    `SELECT COUNT(*) as total FROM campaigns WHERE (status = 'active' OR status = 'running' OR status = 'sending') AND session_id IN (${placeholders})`,
                    sessionIds
                );

                // Agents stats - get admin_phone from sessionId
                let adminPhone = null;
                const [agentUserRows] = await connection.execute(
                    'SELECT phone FROM users WHERE phone = ? OR admin_phone = ? LIMIT 1',
                    [sessionId, sessionId]
                );
                if (agentUserRows.length > 0) {
                    adminPhone = agentUserRows[0].phone;
                }

                const [agents] = await connection.execute(
                    'SELECT COUNT(*) as total FROM users WHERE status = \'active\' AND role IN (\'agent\', \'supervisor\') AND admin_phone = ?',
                    [adminPhone || sessionId]
                );

                // Chatbots
                const [chatbots] = await connection.execute(
                    `SELECT COUNT(DISTINCT cs.session_id) as total FROM chatbot_settings cs
                     INNER JOIN chatbot_flows cf ON cs.session_id = cf.session_id
                     WHERE cs.enabled = 1 AND cf.is_active = 1 AND cs.session_id IN (${placeholders})`,
                    sessionIds
                );

                // Kanbans
                const [kanbans] = await connection.execute(
                    `SELECT COUNT(*) as total FROM kanban_boards WHERE session_id IN (${placeholders})`,
                    sessionIds
                );

                // Conexiones activas - SOLO contar is_active = 1
                const [connections] = await connection.execute(
                    `SELECT COUNT(*) as total FROM user_sessions WHERE is_active = 1 AND session_id IN (${placeholders})`,
                    sessionIds
                );

                res.json({
                    success: true,
                    data: {
                        messages: {
                            total: ms.total || 0,
                            sent: totalSent || 0,
                            delivered: delivered || 0,
                            read: read || 0,
                            failed: failed || 0
                        },
                        deliveryRate: parseFloat(deliveryRate.toFixed(1)),
                        readRate: parseFloat(readRate.toFixed(1)),
                        campaigns: {
                            active: campaigns[0]?.total || 0,
                            total: campaigns[0]?.total || 0
                        },
                        agents: {
                            total: agents[0]?.total || 0,
                            online: agents[0]?.total || 0
                        },
                        chatbots: chatbots[0]?.total || 0,
                        kanbans: kanbans[0]?.total || 0,
                        messagesFailed: failed,
                        failureRate: parseFloat(failureRate.toFixed(1)),
                        connections: connections[0]?.total || 0
                    }
                });
            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('[ANALYTICS] Error in dashboard:', error);
            res.status(500).json({ error: 'Failed to fetch dashboard data' });
        }
    });

    // ============================================
    // CONNECTIONS LIST ENDPOINT
    // ============================================
    /**
     * GET /api/analytics/connections
     * Returns list of all connections (active and inactive) for a user
     */
    app.get('/api/analytics/connections', async (req, res) => {
        try {
            const sessionId = req.query.sessionId || req.sessionID;
            const connection = await pool.getConnection();

            try {
                // Resolve owner phone when sessionId is an email or alias
                let ownerPhone = sessionId;
                if (ownerPhone && ownerPhone.includes('@')) {
                    const [userRows] = await connection.execute(
                        'SELECT phone FROM users WHERE email = ? OR admin_phone = ? LIMIT 1',
                        [ownerPhone, ownerPhone]
                    );
                    if (userRows.length && userRows[0].phone) {
                        ownerPhone = userRows[0].phone;
                    }
                }

                // Fallback: check user_sessions to map email session_id to stored phone/owner_phone_number
                if (ownerPhone && ownerPhone.includes('@')) {
                    const [sessionRows] = await connection.execute(
                        'SELECT phone, owner_phone_number FROM user_sessions WHERE session_id = ? LIMIT 1',
                        [ownerPhone]
                    );
                    if (sessionRows.length) {
                        ownerPhone = sessionRows[0].owner_phone_number || sessionRows[0].phone || ownerPhone;
                    }
                }

                // Collect all related session_ids
                const sessionIdSet = new Set([sessionId]);
                if (ownerPhone) sessionIdSet.add(ownerPhone);

                const [ownerRows] = await connection.execute(
                    'SELECT DISTINCT session_id FROM user_sessions WHERE owner_phone_number = ? OR phone = ? OR session_id = ?',
                    [ownerPhone, ownerPhone, ownerPhone]
                );

                for (const row of ownerRows) {
                    if (row.session_id) {
                        sessionIdSet.add(row.session_id);
                    }
                }

                const sessionIds = Array.from(sessionIdSet);
                const placeholders = sessionIds.map(() => '?').join(',');
                const [connections] = await connection.execute(`
                    SELECT 
                        session_id,
                        phone,
                        full_name,
                        name,
                        avatar_url,
                        is_active,
                        last_activity,
                        created_at,
                        last_connection_time,
                        subscription_status,
                        subscription_plan,
                        subscription_end_date,
                        messages_sent_this_month
                    FROM user_sessions
                    WHERE session_id IN (${placeholders}) 
                        OR owner_phone_number = ?
                        OR phone = ?
                    ORDER BY is_active DESC, last_activity DESC
                `, [...sessionIds, ownerPhone, ownerPhone]);

                // Format connections with connection time calculation
                const sessions = global.sessions || new Map(); // Obtener sesiones desde global
                const formattedConnections = connections.map(conn => {
                    let connectionTime = null;
                    let connectionStatus = 'Desconectado';
                    let displayName = conn.full_name || conn.name || 'Sin nombre';
                    let displayAvatar = conn.avatar_url;

                    // ✅ Si la sesión está en memoria, obtener nombre y avatar de WhatsApp
                    const sessionData = sessions.get(conn.session_id);
                    if (sessionData && sessionData.user) {
                        displayName = sessionData.user.name || sessionData.user.pushname || displayName;
                        displayAvatar = sessionData.user.imgUrl || displayAvatar;
                    }

                    if (conn.is_active === 1) {
                        connectionStatus = 'Conectado';
                        if (conn.last_connection_time) {
                            connectionTime = conn.last_connection_time;
                        }
                    } else if (conn.last_activity) {
                        const lastActivityDate = new Date(conn.last_activity);
                        connectionTime = lastActivityDate.toLocaleString('es-PY');
                    }

                    return {
                        session_id: conn.session_id,
                        phone: conn.phone,
                        full_name: displayName,
                        avatar_url: displayAvatar,
                        is_active: conn.is_active === 1,
                        status: connectionStatus,
                        connection_time: connectionTime,
                        created_at: conn.created_at,
                        last_activity: conn.last_activity,
                        subscription_status: conn.subscription_status,
                        subscription_plan: conn.subscription_plan,
                        subscription_end_date: conn.subscription_end_date,
                        messages_sent_this_month: conn.messages_sent_this_month || 0
                    };
                });

                res.json({
                    success: true,
                    data: {
                        connections: formattedConnections,
                        total: formattedConnections.length,
                        active: formattedConnections.filter(c => c.is_active).length,
                        inactive: formattedConnections.filter(c => !c.is_active).length
                    }
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('[ANALYTICS] Error in connections:', error);
            res.status(500).json({ error: 'Failed to fetch connections' });
        }
    });

    console.log('[ANALYTICS] ✅ Analytics endpoints initialized successfully');
};
