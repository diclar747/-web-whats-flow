/**
 * Endpoints públicos para obtener planes disponibles
 */
function registerPublicPlansEndpoints(app, pool) {

    // Obtener todos los planes activos para mostrar en landing page
    app.get('/api/public/plans', async (req, res) => {
        try {
            const connection = await pool.getConnection();

            try {
                const [plans] = await connection.execute(
                    `SELECT 
                        id,
                        name,
                        price,
                        max_channels,
                        max_messages,
                        max_agents,
                        max_sessions,
                        bot_enabled,
                        api_enabled
                     FROM plans 
                     WHERE 1=1
                     ORDER BY price ASC`
                );

                res.json({
                    success: true,
                    plans: plans
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('[PUBLIC-PLANS] Error:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener planes'
            });
        }
    });

    console.log('[PUBLIC-PLANS] ✅ Endpoints públicos de planes registrados');
}

module.exports = { registerPublicPlansEndpoints };
