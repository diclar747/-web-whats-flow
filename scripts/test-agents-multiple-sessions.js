const axios = require('axios');

async function testAgentsWithDifferentSessions() {
    const baseURL = 'http://localhost:3002';
    
    // Probar con diferentes sessionIds
    const sessionIds = [
        '595985768793',  // SessionId del admin
        'claudio@cnid.com.py', // Email del agente
        '595985768791',  // Teléfono del agente
        'test-session',  // SessionId de prueba
        ''               // SessionId vacío
    ];

    console.log('🧪 PROBANDO ENDPOINT /api/agents/available CON DIFERENTES SESSION IDs');
    console.log('=====================================================================\n');

    for (const sessionId of sessionIds) {
        try {
            console.log(`📡 Probando con sessionId: "${sessionId}"`);
            
            const response = await axios.get(`${baseURL}/api/agents/available`, {
                params: { sessionId },
                timeout: 5000
            });

            console.log(`✅ Éxito: ${response.data.agents.length} agentes encontrados`);
            console.log('   Agentes:', response.data.agents.map(a => `${a.name} (${a.email})`));
            console.log('   Admin encontrado:', response.data.adminPhone || 'No especificado');
            
        } catch (error) {
            if (error.response) {
                console.log(`❌ Error ${error.response.status}: ${error.response.data.error}`);
            } else if (error.code === 'ECONNREFUSED') {
                console.log('❌ Error: Servidor no disponible en localhost:3002');
                break;
            } else {
                console.log(`❌ Error: ${error.message}`);
            }
        }
        console.log('---');
    }

    // Probar también el endpoint de lista de agentes
    console.log('\n🧪 PROBANDO ENDPOINT /api/agents/list (requiere autenticación)');
    console.log('==============================================================\n');

    try {
        const response = await axios.get(`${baseURL}/api/agents/list`);
        console.log(`✅ Éxito: ${response.data.agents.length} agentes encontrados`);
        console.log('   Agentes:', response.data.agents.map(a => `${a.name} (${a.email})`));
    } catch (error) {
        if (error.response) {
            console.log(`❌ Error ${error.response.status}: ${error.response.data.error}`);
        } else {
            console.log(`❌ Error: ${error.message}`);
        }
    }
}

testAgentsWithDifferentSessions().catch(console.error);