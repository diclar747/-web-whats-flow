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

    // ============================================
    // MESSAGE ANALYTICS ENDPOINTS
    // ============================================

    /**
     * GET /api/analytics/messages/overview
     * Returns overall message statistics
     */
    app.get('/api/analytics/messages/overview', async (req, res) => {
        try {
            const sessionId = req.query.sessionId;
            const { startDate, endDate } = getDateRange(req);

            if (!sessionId) {
                return res.status(400).json({ error: 'sessionId is required' });
            }

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
                WHERE session_id = ?
                AND DATE(timestamp) BETWEEN ? AND ?
            `;

            const [results] = await pool.query(query, [sessionId, startDate, endDate]);
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

            const query = `
                SELECT 
                    message_type,
                    COUNT(*) as count
                FROM messages
                WHERE session_id = ?
                AND DATE(timestamp) BETWEEN ? AND ?
                GROUP BY message_type
                ORDER BY count DESC
            `;

            const [results] = await pool.query(query, [sessionId, startDate, endDate]);

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

            const query = `
                SELECT 
                    DATE(timestamp) as date,
                    COUNT(*) as total,
                    SUM(CASE WHEN from_me = 1 THEN 1 ELSE 0 END) as sent,
                    SUM(CASE WHEN from_me = 0 THEN 1 ELSE 0 END) as received,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
                FROM messages
                WHERE session_id = ?
                AND DATE(timestamp) BETWEEN ? AND ?
                GROUP BY DATE(timestamp)
                ORDER BY date ASC
            `;

            const [results] = await pool.query(query, [sessionId, startDate, endDate]);

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

            const query = `
                SELECT 
                    m.agent_id,
                    m.agent_name,
                    COUNT(*) as total_messages,
                    SUM(CASE WHEN m.from_me = 1 THEN 1 ELSE 0 END) as sent,
                    SUM(CASE WHEN m.from_me = 0 THEN 1 ELSE 0 END) as received
                FROM messages m
                WHERE m.session_id = ?
                AND m.agent_id IS NOT NULL
                AND DATE(m.timestamp) BETWEEN ? AND ?
                GROUP BY m.agent_id, m.agent_name
                ORDER BY total_messages DESC
            `;

            const [results] = await pool.query(query, [sessionId, startDate, endDate]);

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
            const hourlyQuery = `
                SELECT 
                    HOUR(timestamp) as hour,
                    COUNT(*) as count
                FROM messages
                WHERE session_id = ?
                AND DATE(timestamp) BETWEEN ? AND ?
                GROUP BY HOUR(timestamp)
                ORDER BY hour ASC
            `;

            const [hourlyResults] = await pool.query(hourlyQuery, [sessionId, startDate, endDate]);

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
        try {
            const sessionId = req.query.sessionId;

            if (!sessionId) {
                return res.status(400).json({ error: 'sessionId is required' });
            }

            const query = `
                SELECT 
                    COUNT(*) as total_agents,
                    SUM(CASE WHEN status = 'available' OR status = 'online' THEN 1 ELSE 0 END) as online_agents,
                    SUM(CASE WHEN status = 'busy' THEN 1 ELSE 0 END) as busy_agents,
                    SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline_agents,
                    SUM(CASE WHEN status = 'away' THEN 1 ELSE 0 END) as away_agents
                FROM agents
                WHERE session_id = ?
                AND is_active = 1
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
                    a.status,
                    a.email,
                    COUNT(DISTINCT ach.id) as total_conversations,
                    SUM(CASE WHEN ach.status = 'closed' THEN 1 ELSE 0 END) as conversations_closed,
                    SUM(ach.messages_count) as total_messages,
                    a.last_activity
                FROM agents a
                LEFT JOIN agent_chat_history ach ON a.id = ach.agent_id
                    AND DATE(ach.assigned_at) BETWEEN ? AND ?
                WHERE a.session_id = ?
                AND a.is_active = 1
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
                JOIN agents a ON ach.agent_id = a.id
                WHERE a.session_id = ?
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
        try {
            const sessionId = req.query.sessionId;
            const { startDate, endDate } = getDateRange(req);

            if (!sessionId) {
                return res.status(400).json({ error: 'sessionId is required' });
            }

            // Get all metrics in parallel
            const [
                messageStats,
                campaignStats,
                agentStats,
                kanbanStats
            ] = await Promise.all([
                // Message stats
                pool.query(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN from_me = 1 THEN 1 ELSE 0 END) as sent,
                        SUM(CASE WHEN from_me = 0 THEN 1 ELSE 0 END) as received,
                        SUM(CASE WHEN status = 'delivered' OR status = 'read' THEN 1 ELSE 0 END) as delivered,
                        SUM(CASE WHEN is_read = 1 THEN 1 ELSE 0 END) as \`read\`,
                        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
                    FROM messages
                    WHERE session_id = ? AND DATE(timestamp) BETWEEN ? AND ?
                `, [sessionId, startDate, endDate]),

                // Campaign stats
                pool.query(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status IN ('active', 'running') THEN 1 ELSE 0 END) as active,
                        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled
                    FROM campaigns
                    WHERE session_id = ?
                `, [sessionId]),

                // Agent stats
                pool.query(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status IN ('available', 'online') THEN 1 ELSE 0 END) as online,
                        SUM(CASE WHEN status = 'busy' THEN 1 ELSE 0 END) as busy
                    FROM agents
                    WHERE session_id = ? AND is_active = 1
                `, [sessionId]),

                // Kanban stats
                pool.query(`
                    SELECT 
                        COUNT(DISTINCT kb.id) as boards,
                        COUNT(kc.id) as contacts
                    FROM kanban_boards kb
                    LEFT JOIN kanban_contacts kc ON kb.id = kc.board_id
                    WHERE kb.session_id = ?
                `, [sessionId])
            ]);

            const messages = messageStats[0][0];
            const campaigns = campaignStats[0][0];
            const agents = agentStats[0][0];
            const kanban = kanbanStats[0][0];

            // Calculate KPIs
            const deliveryRate = calculatePercentage(messages.delivered, messages.sent);
            const readRate = calculatePercentage(messages.read, messages.sent);
            const responseRate = calculatePercentage(messages.received, messages.sent);
            const failureRate = calculatePercentage(messages.failed, messages.sent);

            res.json({
                success: true,
                data: {
                    messages: {
                        total: messages.total,
                        sent: messages.sent,
                        received: messages.received,
                        delivered: messages.delivered,
                        read: messages.read,
                        failed: messages.failed
                    },
                    campaigns: {
                        total: campaigns.total,
                        active: campaigns.active,
                        scheduled: campaigns.scheduled
                    },
                    agents: {
                        total: agents.total,
                        online: agents.online,
                        busy: agents.busy
                    },
                    kanban: {
                        boards: kanban.boards,
                        contacts: kanban.contacts
                    },
                    kpis: {
                        delivery_rate: deliveryRate,
                        read_rate: readRate,
                        response_rate: responseRate,
                        failure_rate: failureRate
                    }
                },
                period: { startDate, endDate }
            });

        } catch (error) {
            console.error('[ANALYTICS] Error in dashboard:', error);
            res.status(500).json({ error: 'Failed to fetch dashboard data' });
        }
    });

    console.log('[ANALYTICS] ✅ Analytics endpoints initialized successfully');
};
