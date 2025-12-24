const http = require('http');

function request(options, body) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ status: res.status, data }));
        });
        req.on('error', (e) => reject(new Error(`Request Error: ${e.message} (Code: ${e.code})`)));
        req.on('timeout', () => reject(new Error('Request Timeout')));
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function debugCreateAgent() {
    const payload = {
        name: 'Agente de Prueba',
        email: 'testagent_' + Date.now() + '@whats-flow.com',
        phone: '123456789',
        password: 'password123',
        max_concurrent_chats: 5,
        sessionId: '595985768793'
    };

    console.log('Testing /api/agents/create...');
    try {
        const res = await request({
            host: 'localhost',
            port: 3002,
            path: '/api/agents/create',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, payload);
        console.log('Status /api/agents/create:', res.status);
        console.log('Response /api/agents/create:', res.data);
    } catch (e) {
        console.log('Error /api/agents/create:', e.message);
    }

    console.log('\nTesting /api/agents...');
    try {
        const res = await request({
            host: 'localhost',
            port: 3002,
            path: '/api/agents',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, payload);
        console.log('Status /api/agents:', res.status);
        console.log('Response /api/agents:', res.data);
    } catch (e) {
        console.log('Error /api/agents:', e.message);
    }
}

debugCreateAgent();
