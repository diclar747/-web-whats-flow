#!/usr/bin/env node

/**
 * Script para verificar que las transferencias de agentes funcionen correctamente
 * después de las correcciones aplicadas
 */

const https = require('https');

// Configuración
const BASE_URL = 'https://web.whats-flow.com';
const TEST_AGENT_ID = 1; // Cambiar por un ID de agente real
const TEST_CHAT_JID = '1234567890@s.whatsapp.net'; // Cambiar por un chat real
const TEST_SESSION_ID = 'test-session'; // Cambiar por un session_id real

// Función para hacer peticiones HTTPS
function makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    resolve({
                        statusCode: res.statusCode,
                        data: parsed
                    });
                } catch (error) {
                    resolve({
                        statusCode: res.statusCode,
                        data: responseData
                    });
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

// Test 1: Verificar endpoint de agentes
async function testAgentsEndpoint() {
    console.log('🧪 Test 1: Verificando endpoint de agentes...');
    
    try {
        const options = {
            hostname: 'web.whats-flow.com',
            path: '/api/agents',
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        const result = await makeRequest(options);
        console.log(`📊 Status: ${result.statusCode}`);
        
        if (result.statusCode === 200) {
            console.log('✅ Endpoint de agentes funciona correctamente');
            if (result.data && Array.isArray(result.data)) {
                console.log(`📋 Número de agentes: ${result.data.length}`);
            }
        } else {
            console.log('❌ Error en endpoint de agentes:', result.data);
        }
    } catch (error) {
        console.log('❌ Error en test de agentes:', error.message);
    }
}

// Test 2: Verificar endpoint de transferencias pendientes
async function testPendingTransfers() {
    console.log('\n🧪 Test 2: Verificando transferencias pendientes...');
    
    try {
        const options = {
            hostname: 'web.whats-flow.com',
            path: `/api/agent/pending-transfers?agentId=${TEST_AGENT_ID}`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        const result = await makeRequest(options);
        console.log(`📊 Status: ${result.statusCode}`);
        
        if (result.statusCode === 200) {
            console.log('✅ Endpoint de transferencias pendientes funciona');
            if (result.data && Array.isArray(result.data)) {
                console.log(`📋 Transferencias pendientes: ${result.data.length}`);
            }
        } else {
            console.log('❌ Error en transferencias pendientes:', result.data);
        }
    } catch (error) {
        console.log('❌ Error en test de transferencias pendientes:', error.message);
    }
}

// Test 3: Verificar estructura de chat_assignments
async function testChatAssignmentsStructure() {
    console.log('\n🧪 Test 3: Verificando estructura de chat_assignments...');
    
    try {
        const options = {
            hostname: 'web.whats-flow.com',
            path: '/api/debug/chat-assignments',
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        const result = await makeRequest(options);
        console.log(`📊 Status: ${result.statusCode}`);
        
        if (result.statusCode === 200) {
            console.log('✅ Estructura de chat_assignments verificada');
            if (result.data) {
                console.log('📋 Datos de chat_assignments:', JSON.stringify(result.data, null, 2));
            }
        } else {
            console.log('⚠️ Endpoint de debug no disponible, continuando...');
        }
    } catch (error) {
        console.log('⚠️ Error en test de estructura (puede ser normal):', error.message);
    }
}

// Test 4: Verificar que el servidor esté funcionando
async function testServerHealth() {
    console.log('\n🧪 Test 4: Verificando salud del servidor...');
    
    try {
        const options = {
            hostname: 'web.whats-flow.com',
            path: '/',
            method: 'GET'
        };
        
        const result = await makeRequest(options);
        console.log(`📊 Status: ${result.statusCode}`);
        
        if (result.statusCode === 200) {
            console.log('✅ Servidor funcionando correctamente');
        } else {
            console.log('⚠️ Servidor responde con status:', result.statusCode);
        }
    } catch (error) {
        console.log('❌ Error conectando al servidor:', error.message);
    }
}

// Función principal
async function runTests() {
    console.log('🚀 Iniciando verificación del sistema de transferencias...\n');
    
    await testServerHealth();
    await testAgentsEndpoint();
    await testPendingTransfers();
    await testChatAssignmentsStructure();
    
    console.log('\n📋 Resumen de la verificación:');
    console.log('✅ Endpoints corregidos:');
    console.log('   - /api/agent/accept-transfer (búsqueda directa en chat_assignments)');
    console.log('   - /api/agent/reject-transfer (búsqueda directa en chat_assignments)');
    console.log('   - Eliminado uso de getAllSessionIds para transferencias');
    console.log('   - Agregado logging detallado para debug');
    console.log('   - Fallback a session_id del agente si no se encuentra asignación');
    
    console.log('\n🔧 Próximos pasos:');
    console.log('1. Probar transferir un chat desde el admin a un agente');
    console.log('2. Verificar que el agente reciba la notificación');
    console.log('3. Probar que el agente pueda aceptar la transferencia');
    console.log('4. Probar que el agente pueda rechazar la transferencia');
    
    console.log('\n📝 Nota: Los tests usan IDs de ejemplo. Para pruebas reales, usar IDs reales del sistema.');
}

// Ejecutar tests
runTests().catch(console.error);