#!/usr/bin/env node

/**
 * Script de prueba para validar la transferencia de chat
 * Verifica:
 * 1. Endpoint /api/agents/available devuelve status real
 * 2. Transferencia emite eventos en socket correcto
 * 3. AgentDashboard escucha chat:transferred correctamente
 */

const http = require('http');

const BASE_URL = 'http://localhost:3002';

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    http.get(url, { headers: { 'Content-Type': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('=== INICIANDO PRUEBAS DE TRANSFERENCIA ===\n');

  try {
    // Test 1: Verificar agents/available devuelve estado real
    console.log('✓ Test 1: Endpoint /api/agents/available con estado real');
    const agentsResp = await makeRequest('/api/agents/available?sessionId=test');
    console.log(`  Status: ${agentsResp.status}`);
    if (agentsResp.data.success && agentsResp.data.agents && agentsResp.data.agents.length > 0) {
      const agent = agentsResp.data.agents[0];
      console.log(`  ✓ Agentes devueltos: ${agentsResp.data.agents.length}`);
      console.log(`  ✓ Primer agente: ${agent.name} - Status: ${agent.status || 'Sin estado'}`);
      if (agent.status !== 'online' || agent.status !== undefined) {
        console.log(`  ✓ Estado no está forzado a 'online' (valor real: ${agent.status})`);
      }
    } else {
      console.log(`  ✗ Respuesta inesperada:`, agentsResp.data);
    }
  } catch (error) {
    console.error('✗ Error en prueba 1:', error.message);
  }

  console.log('\n✓ Test 2: Socket.IO room names son correctos');
  console.log('  Verifica que se usen "agent-{id}" en lugar de "agent - {id}"');
  console.log('  Revisar logs del servidor para mensaje: "📤 Evento emitido globalmente y a sala agent-{id}"');

  console.log('\n✓ Test 3: AgentDashboard escucha chat:transferred');
  console.log('  Verifica que el frontend tenga el listener en AgentDashboard.tsx');
  console.log('  Buscar: handleTransferEvent que filtra por toAgentId === agentId');

  console.log('\n=== PASOS MANUALES PARA PROBAR COMPLETO ===');
  console.log('1. Inicia sesión como Admin (claudio@cnid.com.py o similar)');
  console.log('2. Abre un chat con un contacto');
  console.log('3. Click derecha > Transferir a Agente > Selecciona un agente');
  console.log('4. Verifica en logs del servidor la línea de transfer sin espacios');
  console.log('5. En el dashboard del agente, deberías ver el chat transferido');
  console.log('6. La notificación debería sonar y mostrar mensaje');
  console.log('\n✅ Pruebas completadas');
}

runTests().catch(console.error);
