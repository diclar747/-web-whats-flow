// ENDPOINT TEMPORAL PARA FORZAR DESCARGA DE AVATARES
// Agregar este código en /var/www/web.whats-flow.com/src/server/index.js
// después de la línea 10050 aproximadamente

app.post('/api/force-download-avatars/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    console.log(`[FORCE-AVATARS] 🖼️ Solicitud de descarga forzada de avatares para sesión: ${sessionId}`);

    try {
        // Buscar la sesión en memoria
        const sessionInfo = sessions.get(sessionId);

        if (!sessionInfo) {
            console.log(`[FORCE-AVATARS] ❌ Sesión no encontrada en memoria: ${sessionId}`);
            return res.status(404).json({
                success: false,
                error: 'Sesión no encontrada. Asegúrate de que WhatsApp esté conectado.'
            });
        }

        if (!sessionInfo.sock) {
            console.log(`[FORCE-AVATARS] ❌ Socket no disponible para sesión: ${sessionId}`);
            return res.status(400).json({
                success: false,
                error: 'Socket de WhatsApp no disponible'
            });
        }

        // Ejecutar descarga de avatares en background
        console.log(`[FORCE-AVATARS] 🚀 Iniciando descarga de avatares...`);

        // Llamar a la función de descarga (no esperar a que termine)
        downloadAllAvatars(sessionId, sessionInfo.sock).then(() => {
            console.log(`[FORCE-AVATARS] ✅ Descarga de avatares completada para ${sessionId}`);
        }).catch(err => {
            console.error(`[FORCE-AVATARS] ❌ Error en descarga de avatares:`, err);
        });

        res.json({
            success: true,
            message: 'Descarga de avatares iniciada. Este proceso puede tomar varios minutos dependiendo de la cantidad de contactos.'
        });

    } catch (error) {
        console.error('[FORCE-AVATARS] ❌ Error:', error);
        res.status(500).json({
            success: false,
            error: 'Error al iniciar descarga de avatares'
        });
    }
});
