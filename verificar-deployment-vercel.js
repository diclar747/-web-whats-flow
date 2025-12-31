/**
 * Script para verificar que el deployment de Vercel funciona correctamente
 * Verifica que los endpoints del backend estén respondiendo correctamente
 */

const https = require('https');

const VERCEL_URL = 'https://whinsapp.vercel.app';

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = `${VERCEL_URL}${path}`;
    console.log(`\n🔍 Probando: ${url}`);
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Content-Type: ${res.headers['content-type']}`);
        
        // Verificar si es HTML o JSON
        if (data.startsWith('<!doctype') || data.startsWith('<!DOCTYPE') || data.startsWith('<html')) {
          console.log(`   ❌ ERROR: Devuelve HTML en lugar de JSON`);
          console.log(`   Primeras 200 chars: ${data.substring(0, 200)}...`);
          resolve({ success: false, status: res.statusCode, isHtml: true });
        } else {
          try {
            const json = JSON.parse(data);
            console.log(`   ✅ Respuesta JSON válida`);
            console.log(`   Datos:`, JSON.stringify(json, null, 2).substring(0, 500));
            resolve({ success: true, status: res.statusCode, data: json });
          } catch (e) {
            console.log(`   ⚠️  No es JSON válido: ${e.message}`);
            console.log(`   Respuesta: ${data.substring(0, 200)}`);
            resolve({ success: false, status: res.statusCode, error: e.message });
          }
        }
      });
    }).on('error', (err) => {
      console.log(`   ❌ Error de red: ${err.message}`);
      reject(err);
    });
  });
}

async function verificarBackend() {
  console.log('='.repeat(70));
  console.log('🚀 VERIFICACIÓN DE DEPLOYMENT EN VERCEL');
  console.log('='.repeat(70));
  console.log(`URL Base: ${VERCEL_URL}`);
  
  const tests = [
    {
      name: 'Frontend (index.html)',
      path: '/',
      expectedHtml: true
    },
    {
      name: 'API - Planes disponibles',
      path: '/api/subscriptions/plans',
      expectedHtml: false
    },
    {
      name: 'API - Health Check',
      path: '/api/health',
      expectedHtml: false
    },
    {
      name: 'API - Subscripción (sin parámetros)',
      path: '/api/subscriptions/my-subscription',
      expectedHtml: false
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await makeRequest(test.path);
      
      if (test.expectedHtml) {
        // Frontend debe devolver HTML
        if (result.isHtml) {
          console.log(`   ✅ CORRECTO: Devuelve HTML como se esperaba`);
          passed++;
        } else {
          console.log(`   ❌ ERROR: Debería devolver HTML`);
          failed++;
        }
      } else {
        // Backend debe devolver JSON
        if (result.success) {
          console.log(`   ✅ CORRECTO: Backend responde con JSON`);
          passed++;
        } else if (result.isHtml) {
          console.log(`   ❌ ERROR CRÍTICO: Backend devuelve HTML - No está funcionando`);
          failed++;
        } else {
          console.log(`   ⚠️  Backend responde pero no con JSON válido`);
          failed++;
        }
      }
      
      // Esperar un poco entre requests
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 RESULTADOS DE LA VERIFICACIÓN');
  console.log('='.repeat(70));
  console.log(`✅ Pruebas exitosas: ${passed}`);
  console.log(`❌ Pruebas fallidas: ${failed}`);
  console.log(`📈 Total: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n✅ ¡DEPLOYMENT EXITOSO! Todos los endpoints funcionan correctamente');
    console.log('\n📝 PRÓXIMOS PASOS:');
    console.log('   1. Ir a: https://bailey-emgiupa4q-diclar747s-projects.vercel.app');
    console.log('   2. Iniciar sesión con: claudio@cnid.com.py');
    console.log('   3. Ir al módulo de "Conexión WhatsApp"');
    console.log('   4. Verificar que muestre "0 / 5" líneas WhatsApp');
    console.log('   5. Hacer clic en "Conectar WhatsApp"');
  } else {
    console.log('\n❌ HAY PROBLEMAS CON EL DEPLOYMENT');
    console.log('\n🔧 POSIBLES SOLUCIONES:');
    console.log('   1. Verificar que vercel.json tenga la configuración correcta');
    console.log('   2. Revisar los logs de Vercel para más detalles');
    console.log('   3. Asegurarse de que src/server/index.js se esté desplegando');
  }
  
  console.log('='.repeat(70));
}

// Ejecutar verificación
verificarBackend().catch(console.error);
