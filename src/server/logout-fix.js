// Middleware para actualizar session=0 en CUALQUIER llamada de logout
module.exports = function setupLogoutFix(app, pool) {
    
    // Interceptar TODAS las llamadas de logout y forzar session=0
    app.use((req, res, next) => {
        if (req.path === '/api/auth/logout' || req.path === '/api/logout-session') {
            console.log(`[LOGOUT-FIX] �� Detectada llamada a ${req.path}`);
            
            // Extraer email del token o sessionId
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            
            if (token) {
                try {
                    const jwt = require('jsonwebtoken');
                    const decoded = jwt.decode(token);
                    const userEmail = decoded?.email;
                    const userId = decoded?.userId || decoded?.id;
                    
                    console.log(`[LOGOUT-FIX] 📧 Usuario: ${userEmail}, ID: ${userId}`);
                    
                    if (userId && pool) {
                        pool.getConnection().then(connection => {
                            connection.query('UPDATE users SET session = 0 WHERE id = ?', [userId])
                                .then(([result]) => {
                                    console.log(`[LOGOUT-FIX] ✅ FORZADO session=0 para userId=${userId}, filas: ${result.affectedRows}`);
                                    connection.release();
                                })
                                .catch(err => {
                                    console.error('[LOGOUT-FIX] ❌ Error:', err);
                                    connection.release();
                                });
                        });
                    }
                } catch (err) {
                    console.error('[LOGOUT-FIX] Error decodificando token:', err);
                }
            }
            
            // Continuar con el endpoint original
            next();
        } else {
            next();
        }
    });
    
    console.log('[LOGOUT-FIX] ✅ Middleware de logout instalado');
};
