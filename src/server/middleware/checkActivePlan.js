/**
 * Middleware para verificar que el usuario tenga un plan activo
 * Restringe acceso a funciones premium (campañas, bot, API, agenda, agentes)
 */

// El pool se debe pasar desde index.js como parámetro
let dbPool = null;

/**
 * Inicializar el middleware con la conexión a la base de datos
 * @param {Pool} pool - MySQL connection pool
 */
function initializePlanMiddleware(pool) {
    dbPool = pool;
}

/**
 * Middleware que verifica si el usuario tiene un plan activo
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
async function checkActivePlan(req, res, next) {
    try {
        const userId = req.user?.id;
        const userEmail = req.user?.email;

        if (!userId && !userEmail) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado'
            });
        }

        if (!dbPool) {
            console.error('[PLAN-CHECK] ❌ Database pool not initialized');
            return res.status(500).json({
                success: false,
                message: 'Error de configuración del servidor'
            });
        }

        // Obtener información del plan del usuario
        const connection = await dbPool.getConnection();
        try {
            const [users] = await connection.execute(
                `SELECT
                    id,
                    email,
                    subscription_status,
                    subscription_end_date,
                    subscription_plan,
                    plan_id
                FROM users
                WHERE id = ? OR email = ?
                LIMIT 1`,
                [userId || null, userEmail || null] // ✅ Convertir undefined a null
            );

            if (!users || users.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }

            const user = users[0];

            // Verificar si el plan está activo
            const isActive = user.subscription_status === 'active';
            const hasValidEndDate = user.subscription_end_date && new Date(user.subscription_end_date) > new Date();

            if (!isActive || !hasValidEndDate) {
                console.log(`[PLAN-CHECK] Usuario ${user.email} sin plan activo. Status: ${user.subscription_status}, End: ${user.subscription_end_date}`);
                return res.status(403).json({
                    success: false,
                    requiresPlan: true,
                    message: 'Para usar esta función necesitas un plan activo. Ve a Configuración → Pestaña "Mi Plan" y elige un plan.',
                    planStatus: {
                        status: user.subscription_status,
                        endDate: user.subscription_end_date,
                        hasActivePlan: false
                    }
                });
            }

            console.log(`[PLAN-CHECK] ✅ Usuario ${user.email} tiene plan activo hasta ${user.subscription_end_date}`);

            // Agregar información del plan al request para uso posterior
            req.userPlan = {
                status: user.subscription_status,
                endDate: user.subscription_end_date,
                planName: user.subscription_plan,
                planId: user.plan_id
            };

            next();
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[PLAN-CHECK] Error verificando plan:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al verificar el plan del usuario'
        });
    }
}

/**
 * Middleware opcional que solo verifica pero no bloquea
 * Útil para endpoints que quieren saber el estado pero no bloquear
 */
async function checkPlanStatus(req, res, next) {
    try {
        const userId = req.user?.id;
        const userEmail = req.user?.email;

        if (!userId && !userEmail) {
            req.userPlan = { hasActivePlan: false };
            return next();
        }

        if (!dbPool) {
            req.userPlan = { hasActivePlan: false };
            return next();
        }

        const connection = await dbPool.getConnection();
        try {
            const [users] = await connection.execute(
                `SELECT subscription_status, subscription_end_date, subscription_plan, plan_id
                FROM users WHERE id = ? OR email = ? LIMIT 1`,
                [userId, userEmail]
            );

            if (users && users.length > 0) {
                const user = users[0];
                const isActive = user.subscription_status === 'active';
                const hasValidEndDate = user.subscription_end_date && new Date(user.subscription_end_date) > new Date();

                req.userPlan = {
                    hasActivePlan: isActive && hasValidEndDate,
                    status: user.subscription_status,
                    endDate: user.subscription_end_date,
                    planName: user.subscription_plan,
                    planId: user.plan_id
                };
            } else {
                req.userPlan = { hasActivePlan: false };
            }
        } finally {
            connection.release();
        }

        next();
    } catch (error) {
        console.error('[PLAN-STATUS] Error verificando estado del plan:', error);
        req.userPlan = { hasActivePlan: false };
        next();
    }
}

module.exports = {
    initializePlanMiddleware,
    checkActivePlan,
    checkPlanStatus
};
