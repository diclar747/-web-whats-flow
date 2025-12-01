const http = require('http');

async function testAgentsAvailable() {
    return new Promise((resolve, reject) => {
        console.log('🧪 Probando endpoint /api/agents/available...');
        
        // Usar una sesión existente para probar
        const sessionId = '595985768793'; // La sesión del usuario
        const options = {
            hostname: 'localhost',
            port: 3002,
            path: `/api/agents/available?sessionId=${sessionId}`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        console.log(`📡 URL: http://${options.hostname}:${options.port}${options.path}`);
        
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    
                    console.log('📊 Respuesta del servidor:');
                    console.log(JSON.stringify(response, null, 2));
                    
                    if (response.success) {
                        console.log(`✅ Éxito: ${response.agents.length} agentes encontrados`);
                        console.log(`📞 Admin: ${response.adminPhone}`);
                        console.log(`🆔 Sesión: ${response.sessionId}`);
                        
                        response.agents.forEach((agent, index) => {
                            console.log(`\n👤 Agente ${index + 1}:`);
                            console.log(`   ID: ${agent.id}`);
                            console.log(`   Nombre: ${agent.name}`);
                            console.log(`   Email: ${agent.email}`);
                            console.log(`   Estado: ${agent.status}`);
                            console.log(`   Activo: ${agent.is_active}`);
                        });
                    } else {
                        console.log('❌ Error:', response.error);
                    }
                    
                    resolve(response);
                } catch (error) {
                    console.error('❌ Error parseando respuesta:', error.message);
                    reject(error);
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('❌ Error en la petición:', error.message);
            reject(error);
        });
        
        req.end();
    });
}

testAgentsAvailable().catch(console.error);