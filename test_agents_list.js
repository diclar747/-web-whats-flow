const jwt = require('jsonwebtoken');

// Simular token del admin
const JWT_SECRET = process.env.JWT_SECRET || '0927450953d52b804a8e511e5a7f2f35bbd20f6c4c156902b4e0902214795eb4c6dafffc36e40489d6eda1ae3963ac42c2d043ab3a4a6382bc62c70fe8ed3a7b';

const adminToken = jwt.sign(
    { id: 1, email: 'claudio@cnid.com.py', phone: '595985768793', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '24h' }
);

console.log('\n🔐 Token de Admin:');
console.log(adminToken);

// Test con curl
const { exec } = require('child_process');

const curlCmd = `curl -s -H "Authorization: Bearer ${adminToken}" http://localhost:3001/api/agents/list?sessionId=1`;

console.log('\n🔍 Probando /api/agents/list...\n');

exec(curlCmd, (error, stdout, stderr) => {
    if (error) {
        console.error('❌ Error:', error.message);
        return;
    }

    console.log('📡 Respuesta:');
    try {
        const response = JSON.parse(stdout);
        console.log(JSON.stringify(response, null, 2));

        if (response.agents) {
            console.log(`\n✅ Total agentes: ${response.agents.length}`);
        }
    } catch (e) {
        console.log(stdout);
    }
});
