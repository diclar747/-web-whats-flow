// =====================================================
// PUSH NOTIFICATIONS MODULE - API ENDPOINTS
// =====================================================
// Created: 2026-01-16
// Description: Complete REST API for Push Notifications
// =====================================================

const crypto = require('crypto');
const webpush = require('web-push');

module.exports = function (app, db) {

    // Importar middleware de autenticación
    const { authenticateToken } = require('./middleware/auth');

    // =====================================================
    // UTILITY FUNCTIONS
    // =====================================================

    /**
     * Generate unique URL code for subscription
     */
    function generateUrlCode() {
        return crypto.randomBytes(16).toString('hex');
    }

    /**
     * Get or create VAPID keys for user
     */
    async function getVapidKeys(userId) {
        try {
            console.log(`[PUSH] getVapidKeys for user ${userId}`);
            const [rows] = await db.query(
                'SELECT public_key, private_key, subject FROM push_vapid_keys WHERE user_id = ?',
                [userId]
            );

            if (rows.length > 0) {
                console.log(`[PUSH] Found existing VAPID keys for user ${userId}`);
                return {
                    publicKey: rows[0].public_key,
                    privateKey: rows[0].private_key,
                    subject: rows[0].subject
                };
            } else {
                console.log(`[PUSH] Generating new VAPID keys for user ${userId}`);
                // Generate new VAPID keys
                const vapidKeys = webpush.generateVAPIDKeys();
                const subject = `mailto:user${userId}@whatsflow.com`;

                await db.query(
                    'INSERT INTO push_vapid_keys (user_id, public_key, private_key, subject) VALUES (?, ?, ?, ?)',
                    [userId, vapidKeys.publicKey, vapidKeys.privateKey, subject]
                );

                console.log(`[PUSH] Saved new VAPID keys for user ${userId}`);
                return {
                    publicKey: vapidKeys.publicKey,
                    privateKey: vapidKeys.privateKey,
                    subject
                };
            }
        } catch (err) {
            console.error('[PUSH] Error getting VAPID keys:', err);
            throw err;
        }
    }

    /**
     * Log event for audit
     */
    async function logEvent(userId, eventType, entityType, entityId, details, req) {
        try {
            const ipAddress = req.ip || req.connection?.remoteAddress;
            const userAgent = req.headers['user-agent'];

            // Usar try-catch interno para que fallos en log no bloqueen el proceso principal
            await db.query(
                'INSERT INTO push_event_logs (user_id, event_type, entity_type, entity_id, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [userId, eventType, entityType, entityId, JSON.stringify(details), ipAddress, userAgent]
            ).catch(err => console.error('[PUSH] Event log DB error:', err.message));
        } catch (err) {
            console.error('[PUSH] Error logging event (outer):', err);
        }
    }

    // =====================================================
    // CATEGORIES ENDPOINTS
    // =====================================================

    /**
     * GET /api/push/categories
     * Get all categories for user
     */
    app.get('/api/push/categories', authenticateToken, async (req, res) => {
        try {
            const userId = req.user?.id || req.session?.userId;
            if (!userId) {
                return res.status(401).json({ error: 'No autorizado' });
            }

            const [rows] = await db.query(
                `SELECT c.*, 
                    (SELECT COUNT(*) FROM push_subscribers s WHERE s.category_id = c.id AND s.is_active = TRUE) as subscriber_count
                FROM push_categories c
                WHERE c.user_id = ?
                ORDER BY c.name ASC`,
                [userId]
            );

            res.json({
                success: true,
                categories: rows
            });
        } catch (error) {
            console.error('[PUSH] Get categories error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/push/categories
     * Create new category
     */
    app.post('/api/push/categories', authenticateToken, async (req, res) => {
        try {
            const userId = req.user?.id || req.session?.userId;
            if (!userId) {
                return res.status(401).json({ error: 'No autorizado' });
            }

            const { name, description, color, icon } = req.body;

            if (!name || name.trim() === '') {
                return res.status(400).json({ error: 'El nombre es requerido' });
            }

            const [result] = await db.query(
                'INSERT INTO push_categories (user_id, name, description, color, icon) VALUES (?, ?, ?, ?, ?)',
                [userId, name.trim(), description || null, color || '#3b82f6', icon || 'tag']
            );

            const categoryId = result.insertId;

            // Log de forma asíncrona pero sin bloquear la respuesta
            logEvent(userId, 'category_created', 'category', categoryId, { name }, req);

            res.json({
                success: true,
                categoryId: categoryId,
                message: 'Categoría creada exitosamente'
            });
        } catch (error) {
            console.error('[PUSH] Create category error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * PUT /api/push/categories/:id
     * Update category
     */
    app.put('/api/push/categories/:id', authenticateToken, async (req, res) => {
        try {
            const userId = req.user?.id || req.session?.userId;
            const categoryId = parseInt(req.params.id);
            const { name, description, color, icon } = req.body;

            if (!userId) {
                return res.status(401).json({ error: 'No autorizado' });
            }

            if (!name || name.trim() === '') {
                return res.status(400).json({ error: 'El nombre es requerido' });
            }

            const [result] = await db.query(
                `UPDATE push_categories 
                SET name = ?, description = ?, color = ?, icon = ?
                WHERE id = ? AND user_id = ?`,
                [name.trim(), description || null, color || '#3b82f6', icon || 'tag', categoryId, userId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Categoría no encontrada' });
            }

            logEvent(userId, 'category_updated', 'category', categoryId, { name }, req);

            res.json({ success: true, message: 'Categoría actualizada' });
        } catch (error) {
            console.error('[PUSH] Update category error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * DELETE /api/push/categories/:id
     * Delete category
     */
    app.delete('/api/push/categories/:id', authenticateToken, async (req, res) => {
        try {
            const userId = req.user?.id || req.session?.userId;
            const categoryId = parseInt(req.params.id);

            if (!userId) {
                return res.status(401).json({ error: 'No autorizado' });
            }

            const [result] = await db.query(
                'DELETE FROM push_categories WHERE id = ? AND user_id = ?',
                [categoryId, userId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Categoría no encontrada' });
            }

            logEvent(userId, 'category_deleted', 'category', categoryId, {}, req);

            res.json({ success: true, message: 'Categoría eliminada' });
        } catch (error) {
            console.error('[PUSH] Delete category error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // =====================================================
    // SUBSCRIPTION URLS ENDPOINTS
    // =====================================================

    /**
     * GET /api/push/urls
     * Get all subscription URLs for user
     */
    app.get('/api/push/urls', authenticateToken, async (req, res) => {
        try {
            const userId = req.user?.id || req.session?.userId;
            if (!userId) {
                return res.status(401).json({ error: 'No autorizado' });
            }

            const [rows] = await db.query(
                `SELECT 
                    u.*,
                    c.name as category_name,
                    c.color as category_color,
                    COUNT(DISTINCT s.id) as subscriber_count
                FROM push_subscription_urls u
                LEFT JOIN push_categories c ON u.category_id = c.id
                LEFT JOIN push_subscribers s ON u.id = s.subscription_url_id AND s.is_active = TRUE
                WHERE u.user_id = ?
                GROUP BY u.id
                ORDER BY u.created_at DESC`,
                [userId]
            );
            res.json({ urls: rows });
        } catch (error) {
            console.error('[PUSH] URLs error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/push/urls
     * Create new subscription URL
     */
    app.post('/api/push/urls', authenticateToken, async (req, res) => {
        try {
            const userId = req.user?.id || req.session?.userId;
            if (!userId) {
                return res.status(401).json({ error: 'No autorizado' });
            }

            const {
                name,
                description,
                categoryId,
                redirectUrl,
                welcomeMessage,
                maxSubscribers,
                expiresAt
            } = req.body;

            if (!name || name.trim() === '') {
                return res.status(400).json({ error: 'El nombre es requerido' });
            }

            const urlCode = generateUrlCode();

            const [result] = await db.query(
                `INSERT INTO push_subscription_urls 
                (user_id, category_id, url_code, name, description, redirect_url, welcome_message, max_subscribers, expires_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    categoryId || null,
                    urlCode,
                    name.trim(),
                    description || null,
                    redirectUrl || null,
                    welcomeMessage || null,
                    maxSubscribers || null,
                    expiresAt || null
                ]
            );

            const fullUrl = `${req.protocol}://${req.get('host')}/subscribe/${urlCode}`;

            logEvent(userId, 'url_created', 'url', result.insertId, { name, urlCode }, req);

            res.json({
                success: true,
                urlId: result.insertId,
                urlCode,
                fullUrl,
                message: 'URL de suscripción creada exitosamente'
            });
        } catch (error) {
            console.error('[PUSH] Create URL error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * PUT /api/push/urls/:id
     * Update subscription URL
     */
    app.put('/api/push/urls/:id', authenticateToken, async (req, res) => {
        try {
            const userId = req.user?.id || req.session?.userId;
            const urlId = parseInt(req.params.id);

            if (!userId) {
                return res.status(401).json({ error: 'No autorizado' });
            }

            const {
                name,
                description,
                categoryId,
                isActive,
                redirectUrl,
                welcomeMessage,
                maxSubscribers,
                expiresAt
            } = req.body;

            const [result] = await db.query(
                `UPDATE push_subscription_urls 
                SET name = ?, description = ?, category_id = ?, is_active = ?, 
                    redirect_url = ?, welcome_message = ?, max_subscribers = ?, expires_at = ?
                WHERE id = ? AND user_id = ?`,
                [
                    name,
                    description,
                    categoryId,
                    isActive,
                    redirectUrl,
                    welcomeMessage,
                    maxSubscribers,
                    expiresAt,
                    urlId,
                    userId
                ]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'URL no encontrada' });
            }

            res.json({ success: true, message: 'URL actualizada' });
        } catch (error) {
            console.error('[PUSH] Update URL error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * DELETE /api/push/urls/:id
     * Delete subscription URL
     */
    app.delete('/api/push/urls/:id', authenticateToken, async (req, res) => {
        try {
            const userId = req.user?.id || req.session?.userId;
            const urlId = parseInt(req.params.id);

            if (!userId) {
                return res.status(401).json({ error: 'No autorizado' });
            }

            const [result] = await db.query(
                'DELETE FROM push_subscription_urls WHERE id = ? AND user_id = ?',
                [urlId, userId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'URL no encontrada' });
            }

            res.json({ success: true, message: 'URL eliminada' });
        } catch (error) {
            console.error('[PUSH] Delete URL error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // =====================================================
    // SUBSCRIBERS ENDPOINTS
    // =====================================================

    /**
     * GET /api/push/subscribers
     * Get all subscribers for user
     */
    app.get('/api/push/subscribers', authenticateToken, async (req, res) => {
        try {
            const userId = req.user?.id || req.session?.userId;
            if (!userId) {
                return res.status(401).json({ error: 'No autorizado' });
            }

            const { categoryId, urlId, isActive } = req.query;

            let query = `
                SELECT 
                    s.*,
                    c.name as category_name,
                    c.color as category_color,
                    u.name as subscription_url_name
                FROM push_subscribers s
                LEFT JOIN push_categories c ON s.category_id = c.id
                LEFT JOIN push_subscription_urls u ON s.subscription_url_id = u.id
                WHERE s.user_id = ?
            `;

            const params = [userId];

            if (categoryId) {
                query += ' AND s.category_id = ?';
                params.push(categoryId);
            }

            if (urlId) {
                query += ' AND s.subscription_url_id = ?';
                params.push(urlId);
            }

            if (isActive !== undefined) {
                query += ' AND s.is_active = ?';
                params.push(isActive === 'true' ? 1 : 0);
            }

            query += ' ORDER BY s.subscribed_at DESC';

            const [rows] = await db.query(query, params);
            res.json({ subscribers: rows });
        } catch (error) {
            console.error('[PUSH] Error fetching subscribers:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/push/subscribers/stats
     * Get subscriber statistics
     */
    app.get('/api/push/subscribers/stats', authenticateToken, async (req, res) => {
        try {
            const userId = req.user?.id || req.session?.userId;
            if (!userId) {
                return res.status(401).json({ error: 'No autorizado' });
            }

            const [rows] = await db.query(
                `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN is_active = FALSE THEN 1 ELSE 0 END) as inactive,
                    SUM(CASE WHEN DATE(subscribed_at) = CURDATE() THEN 1 ELSE 0 END) as today,
                    SUM(CASE WHEN subscribed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as this_week,
                    SUM(CASE WHEN subscribed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as this_month
                FROM push_subscribers
                WHERE user_id = ?`,
                [userId]
            );
            res.json({ stats: rows[0] || {} });
        } catch (error) {
            console.error('[PUSH] Stats error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/push/subscribe/:urlCode
     * PUBLIC - Subscribe to push notifications
     */
    app.post('/api/push/subscribe/:urlCode', async (req, res) => {
        try {
            const { urlCode } = req.params;
            const { subscription, name, email, phone } = req.body;

            if (!subscription || !subscription.endpoint) {
                return res.status(400).json({ error: 'Datos de suscripción inválidos' });
            }

            // Verify URL exists and is active
            const [urlRows] = await db.query(
                `SELECT u.*, 
                    (SELECT COUNT(*) FROM push_subscribers WHERE subscription_url_id = u.id AND is_active = TRUE) as current_subscribers
                FROM push_subscription_urls u
                WHERE u.url_code = ? AND u.is_active = TRUE`,
                [urlCode]
            );

            if (urlRows.length === 0) {
                return res.status(404).json({ error: 'URL de suscripción no encontrada o inactiva' });
            }

            const urlData = urlRows[0];

            // Check expiration
            if (urlData.expires_at && new Date(urlData.expires_at) < new Date()) {
                return res.status(400).json({ error: 'Esta URL de suscripción ha expirado' });
            }

            // Check max subscribers
            if (urlData.max_subscribers && urlData.current_subscribers >= urlData.max_subscribers) {
                return res.status(400).json({ error: 'Se ha alcanzado el límite de suscriptores' });
            }

            const ipAddress = req.ip || req.connection.remoteAddress;
            const userAgent = req.headers['user-agent'];

            // Check if already subscribed
            const [existingRows] = await db.query(
                'SELECT id FROM push_subscribers WHERE endpoint = ? AND user_id = ?',
                [subscription.endpoint, urlData.user_id]
            );

            if (existingRows.length > 0) {
                // Reactivate if inactive
                await db.query(
                    'UPDATE push_subscribers SET is_active = TRUE, last_seen = NOW() WHERE id = ?',
                    [existingRows[0].id]
                );
                res.json({
                    success: true,
                    message: urlData.welcome_message || '¡Suscripción actualizada exitosamente!',
                    redirectUrl: urlData.redirect_url
                });
            } else {
                // Insert new subscriber
                const [result] = await db.query(
                    `INSERT INTO push_subscribers 
                    (user_id, category_id, subscription_url_id, endpoint, p256dh_key, auth_key, 
                     subscriber_name, subscriber_email, subscriber_phone, user_agent, ip_address) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        urlData.user_id,
                        urlData.category_id,
                        urlData.id,
                        subscription.endpoint,
                        subscription.keys.p256dh,
                        subscription.keys.auth,
                        name || null,
                        email || null,
                        phone || null,
                        userAgent,
                        ipAddress
                    ]
                );

                logEvent(urlData.user_id, 'subscribe', 'subscriber', result.insertId, {
                    urlCode,
                    name,
                    email
                }, req);

                res.json({
                    success: true,
                    message: urlData.welcome_message || '¡Suscripción exitosa! Ahora recibirás notificaciones.',
                    redirectUrl: urlData.redirect_url
                });
            }
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Ya estás suscrito' });
            }
            console.error('[PUSH] Subscribe error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/push/unsubscribe
     * Unsubscribe from push notifications
     */
    app.post('/api/push/unsubscribe', async (req, res) => {
        try {
            const { endpoint } = req.body;

            if (!endpoint) {
                return res.status(400).json({ error: 'Endpoint requerido' });
            }

            const [result] = await db.query(
                'UPDATE push_subscribers SET is_active = FALSE, unsubscribed_at = NOW() WHERE endpoint = ?',
                [endpoint]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Suscripción no encontrada' });
            }

            res.json({ success: true, message: 'Suscripción cancelada exitosamente' });
        } catch (error) {
            console.error('[PUSH] Unsubscribe error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/push/public/url-info/:code
     * Public endpoint to get URL info for subscription page
     */
    app.get('/api/push/public/url-info/:code', async (req, res) => {
        try {
            const { code } = req.params;
            const [rows] = await db.query(
                `SELECT u.name, u.description, u.redirect_url, u.is_active, u.expires_at,
                        u.user_id,
                        (SELECT name FROM push_categories WHERE id = u.category_id) as category_name
                 FROM push_subscription_urls u
                 WHERE u.url_code = ?`,
                [code]
            );

            if (rows.length === 0) {
                return res.status(404).json({ error: 'Enlace no válido' });
            }

            const url = rows[0];
            if (!url.is_active) {
                return res.status(400).json({ error: 'Este enlace ya no está activo' });
            }

            if (url.expires_at && new Date(url.expires_at) < new Date()) {
                return res.status(400).json({ error: 'Este enlace ha expirado' });
            }

            res.json({ success: true, url });
        } catch (error) {
            console.error('[PUSH] Public URL info error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/push/subscriber-id
     * Public endpoint for service worker to map endpoint to ID
     */
    app.post('/api/push/subscriber-id', async (req, res) => {
        try {
            const { endpoint } = req.body;
            if (!endpoint) return res.status(400).json({ error: 'Endpoint missing' });

            const [rows] = await db.query(
                'SELECT id FROM push_subscribers WHERE endpoint = ?',
                [endpoint]
            );

            if (rows.length > 0) {
                res.json({ success: true, subscriberId: rows[0].id });
            } else {
                res.status(404).json({ error: 'Subscriber not found' });
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * DELETE /api/push/subscribers/:id
     * Delete subscriber (admin)
     */
    app.delete('/api/push/subscribers/:id', authenticateToken, async (req, res) => {
        try {
            const userId = req.user?.id || req.session?.userId;
            const subscriberId = parseInt(req.params.id);

            if (!userId) {
                return res.status(401).json({ error: 'No autorizado' });
            }

            const [result] = await db.query(
                'DELETE FROM push_subscribers WHERE id = ? AND user_id = ?',
                [subscriberId, userId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Suscriptor no encontrado' });
            }

            res.json({ success: true, message: 'Suscriptor eliminado' });
        } catch (error) {
            console.error('[PUSH] Delete subscriber error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // =====================================================
    // CAMPAIGNS ENDPOINTS
    // =====================================================

    /**
     * GET /api/push/campaigns
     * Get all campaigns for user
     */
    app.get('/api/push/campaigns', authenticateToken, async (req, res) => {
        try {
            const userId = req.user?.id || req.session?.userId;
            if (!userId) {
                return res.status(401).json({ error: 'No autorizado' });
            }

            const { status } = req.query;

            let query = 'SELECT * FROM push_campaigns WHERE user_id = ?';
            const params = [userId];

            if (status) {
                query += ' AND status = ?';
                params.push(status);
            }

            query += ' ORDER BY created_at DESC';

            const [rows] = await db.query(query, params);
            res.json({ campaigns: rows });
        } catch (error) {
            console.error('[PUSH] Error fetching campaigns:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/push/campaigns/:id
     * Get campaign details
     */
    app.get('/api/push/campaigns/:id', authenticateToken, async (req, res) => {
        try {
            const userId = req.user?.id || req.session?.userId;
            const campaignId = parseInt(req.params.id);

            if (!userId) {
                return res.status(401).json({ error: 'No autorizado' });
            }

            const [rows] = await db.query(
                'SELECT * FROM push_campaigns WHERE id = ? AND user_id = ?',
                [campaignId, userId]
            );

            if (rows.length === 0) {
                return res.status(404).json({ error: 'Campaña no encontrada' });
            }

            res.json({ campaign: rows[0] });
        } catch (error) {
            console.error('[PUSH] Campaign error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/push/campaigns
     * Create new campaign
     */
    app.post('/api/push/campaigns', authenticateToken, async (req, res) => {
        try {
            const userId = req.user?.id || req.session?.userId;
            if (!userId) {
                return res.status(401).json({ error: 'No autorizado' });
            }

            const {
                name,
                title,
                description,
                imageUrl,
                actionUrl,
                iconUrl,
                badgeUrl,
                targetAll,
                targetCategoryIds,
                targetSubscriberIds,
                sendImmediately,
                scheduledAt,
                ttl,
                urgency,
                requireInteraction
            } = req.body;

            if (!name || !title || !description) {
                return res.status(400).json({ error: 'Nombre, título y descripción son requeridos' });
            }

            const status = sendImmediately ? 'sending' : 'draft';

            const [result] = await db.query(
                `INSERT INTO push_campaigns 
                (user_id, name, title, description, image_url, action_url, icon_url, badge_url,
                 status, target_all, target_category_ids, target_subscriber_ids, 
                 send_immediately, scheduled_at, ttl, urgency, require_interaction)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    name,
                    title,
                    description,
                    imageUrl || null,
                    actionUrl || null,
                    iconUrl || null,
                    badgeUrl || null,
                    status,
                    targetAll || false,
                    targetCategoryIds ? JSON.stringify(targetCategoryIds) : null,
                    targetSubscriberIds ? JSON.stringify(targetSubscriberIds) : null,
                    sendImmediately || false,
                    scheduledAt || null,
                    ttl || 86400,
                    urgency || 'normal',
                    requireInteraction || false
                ]
            );

            const campaignId = result.insertId;

            logEvent(userId, 'campaign_created', 'campaign', campaignId, { name, title }, req);

            if (sendImmediately) {
                // Send campaign immediately (async)
                sendCampaignNotifications(campaignId, userId);
            }

            res.json({
                success: true,
                campaignId,
                message: sendImmediately
                    ? 'Campaña creada y enviándose'
                    : 'Campaña creada como borrador'
            });
        } catch (error) {
            console.error('[PUSH] Create campaign error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * PUT /api/push/campaigns/:id
     * Update campaign
     */
    app.put('/api/push/campaigns/:id', authenticateToken, async (req, res) => {
        try {
            const userId = req.user?.id || req.session?.userId;
            const campaignId = parseInt(req.params.id);

            if (!userId) {
                return res.status(401).json({ error: 'No autorizado' });
            }

            const {
                name,
                title,
                description,
                imageUrl,
                actionUrl,
                iconUrl,
                badgeUrl,
                targetAll,
                targetCategoryIds,
                targetSubscriberIds,
                scheduledAt,
                ttl,
                urgency,
                requireInteraction
            } = req.body;

            const [result] = await db.query(
                `UPDATE push_campaigns 
                SET name = ?, title = ?, description = ?, image_url = ?, action_url = ?, 
                    icon_url = ?, badge_url = ?, target_all = ?, target_category_ids = ?, 
                    target_subscriber_ids = ?, scheduled_at = ?, ttl = ?, urgency = ?, 
                    require_interaction = ?
                WHERE id = ? AND user_id = ? AND status = 'draft'`,
                [
                    name,
                    title,
                    description,
                    imageUrl,
                    actionUrl,
                    iconUrl,
                    badgeUrl,
                    targetAll,
                    targetCategoryIds ? JSON.stringify(targetCategoryIds) : null,
                    targetSubscriberIds ? JSON.stringify(targetSubscriberIds) : null,
                    scheduledAt,
                    ttl,
                    urgency,
                    requireInteraction,
                    campaignId,
                    userId
                ]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    error: 'Campaña no encontrada o no se puede editar (solo borradores)'
                });
            }

            res.json({ success: true, message: 'Campaña actualizada' });
        } catch (error) {
            console.error('[PUSH] Update campaign error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/push/campaigns/:id/send
     * Send campaign
     */
    app.post('/api/push/campaigns/:id/send', authenticateToken, async (req, res) => {
        try {
            const userId = req.user?.id || req.session?.userId;
            const campaignId = parseInt(req.params.id);

            if (!userId) {
                return res.status(401).json({ error: 'No autorizado' });
            }

            // Verify campaign exists and is in draft status
            const [rows] = await db.query(
                'SELECT * FROM push_campaigns WHERE id = ? AND user_id = ? AND status = "draft"',
                [campaignId, userId]
            );

            if (rows.length === 0) {
                return res.status(404).json({
                    error: 'Campaña no encontrada o ya fue enviada'
                });
            }

            // Update status to sending
            await db.query(
                'UPDATE push_campaigns SET status = "sending", sent_at = NOW() WHERE id = ?',
                [campaignId]
            );

            logEvent(userId, 'campaign_sent', 'campaign', campaignId, {
                name: rows[0].name
            }, req);

            // Send notifications (async)
            sendCampaignNotifications(campaignId, userId);

            res.json({
                success: true,
                message: 'Campaña enviándose'
            });
        } catch (error) {
            console.error('[PUSH] Send campaign error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * DELETE /api/push/campaigns/:id
     * Delete campaign (only drafts)
     */
    app.delete('/api/push/campaigns/:id', authenticateToken, async (req, res) => {
        try {
            const userId = req.user?.id || req.session?.userId;
            const campaignId = parseInt(req.params.id);

            if (!userId) {
                return res.status(401).json({ error: 'No autorizado' });
            }

            // Primero eliminar analíticas vinculadas
            await db.query(
                'DELETE FROM push_campaign_analytics WHERE campaign_id = ?',
                [campaignId]
            );

            // Luego eliminar la campaña
            const [result] = await db.query(
                'DELETE FROM push_campaigns WHERE id = ? AND user_id = ?',
                [campaignId, userId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    error: 'Campaña no encontrada o no tienes permiso'
                });
            }

            res.json({ success: true, message: 'Campaña y analíticas eliminadas exitosamente' });
        } catch (error) {
            console.error('[PUSH] Delete campaign error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/push/campaigns/:id/resend
     * Resend an already sent campaign
     */
    app.post('/api/push/campaigns/:id/resend', authenticateToken, async (req, res) => {
        try {
            let userId = req.user?.id || req.session?.userId;
            const campaignId = parseInt(req.params.id);

            if (!userId) {
                return res.status(401).json({ error: 'No autorizado' });
            }

            // Resolve numeric ID for Admins (admin_PHONE -> ID)
            if (typeof userId === 'string' && userId.startsWith('admin_')) {
                const phone = userId.replace('admin_', '');
                try {
                    const [uRows] = await db.query('SELECT id FROM users WHERE phone = ? LIMIT 1', [phone]);
                    if (uRows.length > 0) {
                        console.log(`[PUSH] Resolved admin userId ${userId} -> ${uRows[0].id}`);
                        userId = uRows[0].id;
                    }
                } catch (e) {
                    console.error('[PUSH] Failed to resolve admin ID:', e);
                }
            }

            console.log(`[PUSH] Resend request: campaignId=${campaignId}, userId=${userId}`);

            // Verificar que la campaña exista
            const [rows] = await db.query(
                'SELECT * FROM push_campaigns WHERE id = ? AND user_id = ?',
                [campaignId, userId]
            );

            if (rows.length === 0) {
                console.warn(`[PUSH] Campaign not found for resend: id=${campaignId}, userId=${userId}`);
                // Intento debug: buscar si existe con otro user_id
                const [allRows] = await db.query('SELECT user_id FROM push_campaigns WHERE id = ?', [campaignId]);
                if (allRows.length > 0) {
                    console.warn(`[PUSH] Campaign ${campaignId} exists but belongs to user ${allRows[0].user_id} (requested by ${userId})`);
                }
                return res.status(404).json({ error: 'Campaña no encontrada' });
            }

            // Reiniciar estadísticas para el reenvío
            await db.query(
                `UPDATE push_campaigns 
                 SET status = 'sending', 
                     total_sent = 0, 
                     total_viewed = 0, 
                     total_clicked = 0,
                     sent_at = NOW() 
                 WHERE id = ?`,
                [campaignId]
            );

            // También podríamos querer limpiar o marcar las analíticas viejas, 
            // pero para un reenvío simple las mantendremos o dejaremos que se sobrepasen 
            // dependiendo de cómo esté la lógica de inserción de analytics.
            // Para ser limpios, eliminamos las analíticas previas si es un reenvío total.
            await db.query(
                'DELETE FROM push_campaign_analytics WHERE campaign_id = ?',
                [campaignId]
            );

            logEvent(userId, 'campaign_resent', 'campaign', campaignId, {
                name: rows[0].name
            }, req);

            // Disparar envío
            sendCampaignNotifications(campaignId, userId);

            res.json({
                success: true,
                message: 'Reenvío de campaña iniciado'
            });
        } catch (error) {
            console.error('[PUSH] Resend campaign error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // =====================================================
    // ANALYTICS ENDPOINTS
    // =====================================================

    /**
     * GET /api/push/analytics/campaign/:id
     * Get campaign analytics
     */
    app.get('/api/push/analytics/campaign/:id', authenticateToken, async (req, res) => {
        try {
            const userId = req.user?.id || req.session?.userId;
            const campaignId = parseInt(req.params.id);

            if (!userId) {
                return res.status(401).json({ error: 'No autorizado' });
            }

            // Get campaign details
            const [campaignRows] = await db.query(
                'SELECT * FROM push_campaigns WHERE id = ? AND user_id = ?',
                [campaignId, userId]
            );

            if (campaignRows.length === 0) {
                return res.status(404).json({ error: 'Campaña no encontrada' });
            }

            // Get detailed analytics
            const [analyticsRows] = await db.query(
                `SELECT 
                    a.*,
                    s.subscriber_name,
                    s.subscriber_email
                FROM push_campaign_analytics a
                LEFT JOIN push_subscribers s ON a.subscriber_id = s.id
                WHERE a.campaign_id = ?
                ORDER BY a.sent_at DESC`,
                [campaignId]
            );

            res.json({
                campaign: campaignRows[0],
                analytics: analyticsRows
            });
        } catch (error) {
            console.error('[PUSH] Analytics error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/push/analytics/overview
     * Get overview analytics
     */
    app.get('/api/push/analytics/overview', authenticateToken, async (req, res) => {
        try {
            const userId = req.user?.id || req.session?.userId;
            if (!userId) {
                return res.status(401).json({ error: 'No autorizado' });
            }

            const [rows] = await db.query(
                `SELECT 
                    COUNT(DISTINCT c.id) as total_campaigns,
                    SUM(c.total_sent) as total_sent,
                    SUM(c.total_viewed) as total_viewed,
                    SUM(c.total_clicked) as total_clicked,
                    ROUND(AVG(CASE WHEN c.total_sent > 0 THEN (c.total_viewed / c.total_sent * 100) ELSE 0 END), 2) as avg_view_rate,
                    ROUND(AVG(CASE WHEN c.total_sent > 0 THEN (c.total_clicked / c.total_sent * 100) ELSE 0 END), 2) as avg_click_rate
                FROM push_campaigns c
                WHERE c.user_id = ? AND c.status = 'sent'`,
                [userId]
            );
            res.json({ overview: rows[0] || {} });
        } catch (error) {
            console.error('[PUSH] Overview error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/push/analytics/event
     * Track event (view, click, close)
     */
    app.post('/api/push/analytics/event', async (req, res) => {
        try {
            const { campaignId, subscriberId, eventType } = req.body;

            if (!campaignId || !subscriberId || !eventType) {
                return res.status(400).json({ error: 'Datos incompletos' });
            }

            let updateField = '';
            let campaignField = '';

            switch (eventType) {
                case 'delivered':
                    updateField = 'delivered_at = NOW(), viewed_at = NOW()'; // Delivered implies viewed (shown on screen)
                    campaignField = 'total_delivered = total_delivered + 1, total_viewed = total_viewed + 1';
                    break;
                case 'viewed':
                    updateField = 'viewed_at = NOW(), time_to_view = TIMESTAMPDIFF(SECOND, sent_at, NOW())';
                    campaignField = 'total_viewed = total_viewed + 1';
                    break;
                case 'clicked':
                    updateField = 'clicked_at = NOW(), time_to_click = TIMESTAMPDIFF(SECOND, sent_at, NOW())';
                    campaignField = 'total_clicked = total_clicked + 1';
                    break;
                case 'closed':
                    updateField = 'closed_at = NOW()';
                    break;
                default:
                    return res.status(400).json({ error: 'Tipo de evento inválido' });
            }

            // Update analytics
            await db.query(
                `UPDATE push_campaign_analytics SET ${updateField} WHERE campaign_id = ? AND subscriber_id = ?`,
                [campaignId, subscriberId]
            );

            // Update campaign stats
            if (campaignField) {
                await db.query(
                    `UPDATE push_campaigns SET ${campaignField} WHERE id = ?`,
                    [campaignId]
                );
            }

            res.json({ success: true });
        } catch (error) {
            console.error('[PUSH] Event tracking error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // =====================================================
    // VAPID KEYS ENDPOINT
    // =====================================================

    /**
     * GET /api/push/vapid-public-key
     * Get VAPID public key (Public/Private depending on auth)
     */
    app.get('/api/push/vapid-public-key', async (req, res) => {
        try {
            console.log(`[PUSH] Request to vapid-public-key. Query:`, req.query);
            // Priority 1: Auth user
            let userId = req.user?.id || req.session?.userId;

            // Priority 2: If not auth, check for urlCode in query (for public page)
            if (!userId && req.query.urlCode) {
                console.log(`[PUSH] No user, checking urlCode: ${req.query.urlCode}`);
                const [urlRows] = await db.query(
                    'SELECT user_id FROM push_subscription_urls WHERE url_code = ?',
                    [req.query.urlCode]
                );
                if (urlRows.length > 0) {
                    userId = urlRows[0].user_id;
                    console.log(`[PUSH] Found userId ${userId} from urlCode`);
                } else {
                    console.warn(`[PUSH] urlCode ${req.query.urlCode} not found`);
                }
            }

            // Fallback for global key or if still not found
            if (!userId) {
                console.warn(`[PUSH] No userId found for VAPID key request`);
                // Return a global key or just 401 if we want strict per-user keys
                return res.status(401).json({ error: 'Se requiere identificación de usuario o código de URL' });
            }

            const keys = await getVapidKeys(userId);
            console.log(`[PUSH] Returning public key for user ${userId}`);
            res.json({ publicKey: keys.publicKey });
        } catch (error) {
            console.error('[PUSH] VAPID key error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // =====================================================
    // CAMPAIGN SENDING LOGIC
    // =====================================================

    /**
     * Send push notifications for a campaign
     */
    async function sendCampaignNotifications(campaignId, userId) {
        try {
            console.log(`[PUSH] Starting campaign ${campaignId} for user ${userId}`);

            // Get campaign details
            const [campaignRows] = await db.query(
                'SELECT * FROM push_campaigns WHERE id = ? AND user_id = ?',
                [campaignId, userId]
            );
            const campaign = campaignRows[0];

            if (!campaign) {
                console.error('[PUSH] Campaign not found:', campaignId);
                return;
            }

            // Get VAPID keys
            const vapidKeys = await getVapidKeys(userId);
            webpush.setVapidDetails(
                vapidKeys.subject,
                vapidKeys.publicKey,
                vapidKeys.privateKey
            );

            // Get target subscribers
            let subscribersQuery = `
                SELECT s.* 
                FROM push_subscribers s
                WHERE s.user_id = ? AND s.is_active = TRUE
            `;
            const subscribersParams = [userId];

            if (!campaign.target_all) {
                const categoryIds = campaign.target_category_ids
                    ? JSON.parse(campaign.target_category_ids)
                    : [];
                const subscriberIds = campaign.target_subscriber_ids
                    ? JSON.parse(campaign.target_subscriber_ids)
                    : [];

                if (categoryIds.length > 0) {
                    subscribersQuery += ` AND s.category_id IN (${categoryIds.join(',')})`;
                }

                if (subscriberIds.length > 0) {
                    subscribersQuery += ` AND s.id IN (${subscriberIds.join(',')})`;
                }
            }

            const [subscribers] = await db.query(subscribersQuery, subscribersParams);

            console.log(`[PUSH] Found ${subscribers.length} subscribers for campaign ${campaignId}`);

            // Update total targets
            await db.query(
                'UPDATE push_campaigns SET total_targets = ? WHERE id = ?',
                [subscribers.length, campaignId]
            );

            // Prepare notification payload
            const payload = JSON.stringify({
                title: campaign.title,
                body: campaign.description,
                icon: campaign.icon_url || '/logo192.png',
                badge: campaign.badge_url || '/logo192.png',
                image: campaign.image_url,
                data: {
                    url: campaign.action_url,
                    campaignId: campaign.id,
                    userId: campaign.user_id
                },
                requireInteraction: !!campaign.require_interaction,
                timestamp: Date.now()
            });

            const options = {
                TTL: campaign.ttl || 86400,
                urgency: campaign.urgency || 'normal'
            };

            // Send to each subscriber
            let sentCount = 0;
            let failedCount = 0;

            for (const subscriber of subscribers) {
                try {
                    // Create analytics record
                    const [analyticsResult] = await db.query(
                        `INSERT INTO push_campaign_analytics (campaign_id, subscriber_id, status) 
                         VALUES (?, ?, 'pending')`,
                        [campaignId, subscriber.id]
                    );
                    const analyticsId = analyticsResult.insertId;

                    // Send push notification
                    const pushSubscription = {
                        endpoint: subscriber.endpoint,
                        keys: {
                            p256dh: subscriber.p256dh_key,
                            auth: subscriber.auth_key
                        }
                    };

                    await webpush.sendNotification(pushSubscription, payload, options);

                    // Update analytics - sent
                    await db.query(
                        `UPDATE push_campaign_analytics 
                         SET status = 'sent', sent_at = NOW() 
                         WHERE id = ?`,
                        [analyticsId]
                    );

                    sentCount++;
                } catch (error) {
                    failedCount++;
                    console.error(`[PUSH] Failed to send to subscriber ${subscriber.id}:`, error.message);

                    // Update analytics - failed
                    await db.query(
                        `UPDATE push_campaign_analytics 
                         SET status = 'failed', error_message = ?, response_code = ? 
                         WHERE campaign_id = ? AND subscriber_id = ?`,
                        [error.message, error.statusCode || 0, campaignId, subscriber.id]
                    );

                    // If subscriber endpoint is invalid (410), deactivate
                    if (error.statusCode === 410) {
                        await db.query(
                            'UPDATE push_subscribers SET is_active = FALSE WHERE id = ?',
                            [subscriber.id]
                        );
                    }
                }
            }

            // Update campaign final stats
            await db.query(
                `UPDATE push_campaigns 
                 SET status = 'sent', total_sent = ?, total_failed = ? 
                 WHERE id = ?`,
                [sentCount, failedCount, campaignId]
            );

            console.log(`[PUSH] Campaign ${campaignId} completed: ${sentCount} sent, ${failedCount} failed`);

        } catch (error) {
            console.error(`[PUSH] Error sending campaign ${campaignId}:`, error);

            // Update campaign status to failed
            await db.query(
                'UPDATE push_campaigns SET status = "failed" WHERE id = ?',
                [campaignId]
            );
        }
    }

    console.log('[PUSH] Push Notifications endpoints loaded');
};
