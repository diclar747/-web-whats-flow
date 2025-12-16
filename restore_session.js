#!/usr/bin/env node

const axios = require('axios');

const sessionId = 'b46a5721164a89ef';
const phoneNumber = '595985768793';

console.log(`🔄 Intentando restaurar sesión ${sessionId} (${phoneNumber})...`);

// Llamar al endpoint de QR refresh para forzar la reconexión
axios.post(`http://localhost:3002/api/restore-session`, {
    sessionId: sessionId,
    phone: phoneNumber
}, {
    headers: {
        'Content-Type': 'application/json'
    },
    timeout: 30000
})
.then(response => {
    console.log('✅ Respuesta:', response.data);
})
.catch(error => {
    if (error.response) {
        console.error('❌ Error del servidor:', error.response.data);
    } else {
        console.error('❌ Error:', error.message);
    }
    process.exit(1);
});
