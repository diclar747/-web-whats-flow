const express = require('express');

const app = express();
const PORT = 3002;

app.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Servidor de prueba funcionando',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`✅ Servidor de prueba corriendo en http://localhost:${PORT}`);
    console.log(`🔗 Prueba: http://localhost:${PORT}/test`);
});
