// Script simple para probar fix de media

const axios = require('axios');

// Simular una solicitud de descarga de CDN
const testDownload = async () => {
  try {
    console.log('[TEST] Probando endpoint /api/media/download-cdn-url...');
    
    const testUrl = 'https://www.whatsapp.com/favicon.ico'; // URL de prueba
    
    const response = await axios.post('http://localhost:3003/api/media/download-cdn-url', {
      sessionId: 'test-session',
      mediaUrl: testUrl,
      mimeType: 'image/x-icon'
    }, {
      timeout: 10000
    });
    
    console.log('[TEST] ✅ Respuesta recibida:', response.status);
    console.log('[TEST] Datos:', response.data);
    
  } catch (err) {
    console.log('[TEST] ❌ Error:', err.message);
    if (err.response) {
      console.log('[TEST] Status:', err.response.status);
      console.log('[TEST] Data:', err.response.data);
    }
  }
};

setTimeout(testDownload, 1000);
