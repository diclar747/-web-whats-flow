#!/usr/bin/env node

/**
 * SCRIPT DE VERIFICACIÓN Y OPTIMIZACIÓN COMPLETA DEL SISTEMA
 * Analiza todos los módulos, flujos, sockets y optimizaciones
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuración
const BASE_DIR = process.cwd();
const SRC_DIR = path.join(BASE_DIR, 'src');
const CLIENT_DIR = path.join(SRC_DIR, 'client', 'src');
const SERVER_DIR = path.join(SRC_DIR, 'server');

console.log('🔍 INICIANDO VERIFICACIÓN COMPLETA DEL SISTEMA...\n');

// Resultados del análisis
const resultados = {
  erroresCriticos: [],
  optimizaciones: [],
  warnings: [],
  verificaciones: []
};

// Función para verificar archivos
function verificarArchivo(rutaArchivo, tipo) {
  try {
    if (fs.existsSync(rutaArchivo)) {
      const stats = fs.statSync(rutaArchivo);
      const contenido = fs.readFileSync(rutaArchivo, 'utf8');
      
      return {
        existe: true,
        tamaño: stats.size,
        lineas: contenido.split('\n').length,
        contenido: contenido
      };
    } else {
      return { existe: false };
    }
  } catch (error) {
    return { existe: false, error: error.message };
  }
}

// 1. VERIFICACIÓN DE MÓDULOS CRÍTICOS
console.log('📁 1. VERIFICANDO MÓDULOS CRÍTICOS...');

const modulosCriticos = [
  { nombre: 'WhatsAppWebChat', ruta: path.join(CLIENT_DIR, 'modules', 'WhatsAppWebChat.tsx') },
  { nombre: 'RealChatModule', ruta: path.join(CLIENT_DIR, 'modules', 'RealChatModule.tsx') },
  { nombre: 'WhatsAppContext', ruta: path.join(CLIENT_DIR, 'context', 'WhatsAppContext.tsx') },
  { nombre: 'SocketContext', ruta: path.join(CLIENT_DIR, 'context', 'SocketContext.tsx') },
  { nombre: 'ModernMessageMedia', ruta: path.join(CLIENT_DIR, 'components', 'ModernMessageMedia.tsx') },
  { nombre: 'Server Index', ruta: path.join(SERVER_DIR, 'index.js') },
  { nombre: 'Socket Config', ruta: path.join(CLIENT_DIR, 'utils', 'socketConfig.ts') }
];

modulosCriticos.forEach(modulo => {
  const verif = verificarArchivo(modulo.ruta, 'módulo');
  if (verif.existe) {
    resultados.verificaciones.push(`✅ ${modulo.nombre}: ${verif.lineas} líneas, ${verif.tamaño} bytes`);
    
    // Verificar imports críticos
    if (modulo.contenido) {
      const importsCriticos = [
        'useEffect', 'useState', 'socket', 'io', 'useCallback', 'useMemo'
      ];
      
      const faltanImports = importsCriticos.filter(imp => !modulo.contenido.includes(imp));
      if (faltanImports.length > 0) {
        resultados.warnings.push(`⚠️ ${modulo.nombre}: Faltan imports: ${faltanImports.join(', ')}`);
      }
    }
  } else {
    resultados.erroresCriticos.push(`❌ ${modulo.nombre}: NO EXISTE`);
  }
});

// 2. VERIFICACIÓN DE SOCKETS Y COMUNICACIÓN EN TIEMPO REAL
console.log('\n🔌 2. VERIFICANDO SISTEMA DE SOCKETS...');

// Verificar configuración de Socket.IO
const socketConfig = verificarArchivo(path.join(CLIENT_DIR, 'utils', 'socketConfig.ts'), 'socket config');
if (socketConfig.existe) {
  if (socketConfig.contenido.includes('getSocketURL') && socketConfig.contenido.includes('getAPIBaseURL')) {
    resultados.verificaciones.push('✅ Socket Config: Configuración correcta detectada');
  } else {
    resultados.erroresCriticos.push('❌ Socket Config: Funciones críticas faltantes');
  }
}

// Verificar eventos de socket en el servidor
const serverIndex = verificarArchivo(path.join(SERVER_DIR, 'index.js'), 'server');
if (serverIndex.existe) {
  const eventosSocket = [
    'connect', 'disconnect', 'message', 'join-session', 'new-message',
    'typing', 'stop-typing', 'message-status', 'file-upload'
  ];
  
  const eventosEncontrados = eventosSocket.filter(evento => 
    serverIndex.contenido.includes(`'${evento}'`) || serverIndex.contenido.includes(`"${evento}"`)
  );
  
  resultados.verificaciones.push(`✅ Server Socket: ${eventosEncontrados.length}/${eventosSocket.length} eventos configurados`);
  
  if (eventosEncontrados.length < eventosSocket.length) {
    const eventosFaltantes = eventosSocket.filter(e => !eventosEncontrados.includes(e));
    resultados.warnings.push(`⚠️ Server Socket: Faltan eventos: ${eventosFaltantes.join(', ')}`);
  }
}

// 3. VERIFICACIÓN DE CARGA DE MENSAJES EN TIEMPO REAL
console.log('\n💬 3. VERIFICANDO CARGA DE MENSAJES EN TIEMPO REAL...');

const whatsappContext = verificarArchivo(path.join(CLIENT_DIR, 'context', 'WhatsAppContext.tsx'), 'context');
if (whatsappContext.existe) {
  const funcionesCriticas = [
    'loadMessages', 'sendMessage', 'loadChats', 'setActiveChat',
    'markChatAsRead', 'replyMessage'
  ];
  
  const funcionesEncontradas = funcionesCriticas.filter(func => 
    whatsappContext.contenido.includes(func)
  );
  
  resultados.verificaciones.push(`✅ WhatsApp Context: ${funcionesEncontradas.length}/${funcionesCriticas.length} funciones críticas`);
  
  // Verificar optimizaciones de rendimiento
  const optimizaciones = [
    'useCallback', 'useMemo', 'useRef', 'debounce', 'throttle'
  ];
  
  const optimizacionesEncontradas = optimizaciones.filter(opt => 
    whatsappContext.contenido.includes(opt)
  );
  
  if (optimizacionesEncontradas.length > 0) {
    resultados.optimizaciones.push(`✅ WhatsApp Context: Optimizaciones encontradas: ${optimizacionesEncontradas.join(', ')}`);
  } else {
    resultados.warnings.push('⚠️ WhatsApp Context: Sin optimizaciones de rendimiento detectadas');
  }
}

// 4. VERIFICACIÓN DE MANEJO DE ARCHIVOS MULTIMEDIA
console.log('\n📎 4. VERIFICANDO MANEJO DE ARCHIVOS MULTIMEDIA...');

const modernMessageMedia = verificarArchivo(path.join(CLIENT_DIR, 'components', 'ModernMessageMedia.tsx'), 'media');
if (modernMessageMedia.existe) {
  const tiposArchivo = ['image', 'video', 'audio', 'document', 'sticker'];
  const funcionesArchivo = ['handleDownload', 'getMediaUrl', 'getFileIcon'];
  
  const tiposSoportados = tiposArchivo.filter(tipo => 
    modernMessageMedia.contenido.includes(tipo)
  );
  
  const funcionesImplementadas = funcionesArchivo.filter(func => 
    modernMessageMedia.contenido.includes(func)
  );
  
  resultados.verificaciones.push(`✅ ModernMessageMedia: ${tiposSoportados.length}/${tiposArchivo.length} tipos soportados`);
  resultados.verificaciones.push(`✅ ModernMessageMedia: ${funcionesImplementadas.length}/${funcionesArchivo.length} funciones implementadas`);
  
  // Verificar manejo de errores
  if (modernMessageMedia.contenido.includes('try {') && modernMessageMedia.contenido.includes('catch')) {
    resultados.optimizaciones.push('✅ ModernMessageMedia: Manejo de errores implementado');
  } else {
    resultados.warnings.push('⚠️ ModernMessageMedia: Manejo de errores incompleto');
  }
}

// 5. VERIFICACIÓN DE SISTEMA DE NOTIFICACIONES
console.log('\n🔔 5. VERIFICANDO SISTEMA DE NOTIFICACIONES...');

const notificationHook = verificarArchivo(path.join(CLIENT_DIR, 'hooks', 'useModernNotification.tsx'), 'notifications');
if (notificationHook.existe) {
  const tiposNotificacion = ['success', 'error', 'warning', 'info', 'confirm'];
  const funcionesNotificacion = ['showNotification', 'showSuccess', 'showError', 'showWarning', 'showInfo', 'showConfirm'];
  
  const tiposImplementados = tiposNotificacion.filter(tipo => 
    notificationHook.contenido.includes(tipo)
  );
  
  const funcionesImplementadas = funcionesNotificacion.filter(func => 
    notificationHook.contenido.includes(func)
  );
  
  resultados.verificaciones.push(`✅ Notifications: ${tiposImplementados.length}/${tiposNotificacion.length} tipos implementados`);
  resultados.verificaciones.push(`✅ Notifications: ${funcionesImplementadas.length}/${funcionesNotificacion.length} funciones implementadas`);
}

// 6. VERIFICACIÓN DE OPTIMIZACIONES DE RENDIMIENTO
console.log('\n⚡ 6. VERIFICANDO OPTIMIZACIONES DE RENDIMIENTO...');

// Verificar uso de React.memo, useMemo, useCallback
const archivosReact = [
  path.join(CLIENT_DIR, 'modules', 'WhatsAppWebChat.tsx'),
  path.join(CLIENT_DIR, 'modules', 'RealChatModule.tsx'),
  path.join(CLIENT_DIR, 'context', 'WhatsAppContext.tsx')
];

archivosReact.forEach(archivo => {
  const verif = verificarArchivo(archivo, 'optimización');
  if (verif.existe && verif.contenido) {
    const nombre = path.basename(archivo);
    const optimizaciones = {
      'React.memo': verif.contenido.includes('React.memo'),
      'useMemo': verif.contenido.includes('useMemo'),
      'useCallback': verif.contenido.includes('useCallback'),
      'useRef': verif.contenido.includes('useRef')
    };
    
    const optimizacionesAplicadas = Object.entries(optimizaciones)
      .filter(([_, aplicada]) => aplicada)
      .map(([opt, _]) => opt);
    
    if (optimizacionesAplicadas.length > 0) {
      resultados.optimizaciones.push(`✅ ${nombre}: Optimizaciones: ${optimizacionesAplicadas.join(', ')}`);
    } else {
      resultados.warnings.push(`⚠️ ${nombre}: Sin optimizaciones de React detectadas`);
    }
  }
});

// 7. VERIFICACIÓN DE SISTEMA DE CACHÉ Y MEMORIA
console.log('\n💾 7. VERIFICANDO SISTEMA DE CACHÉ Y MEMORIA...');

// Verificar manejo de estado local vs servidor
const whatsappContextContent = verificarArchivo(path.join(CLIENT_DIR, 'context', 'WhatsAppContext.tsx'), 'cache');
if (whatsappContextContent.existe) {
  const patronesCache = [
    'localStorage', 'sessionStorage', 'useState', 'useReducer',
    'debounce', 'throttle', 'setTimeout', 'clearTimeout'
  ];
  
  const patronesEncontrados = patronesCache.filter(patron => 
    whatsappContextContent.contenido.includes(patron)
  );
  
  resultados.verificaciones.push(`✅ Cache Management: ${patronesEncontrados.length}/${patronesCache.length} patrones detectados`);
}

// 8. VERIFICACIÓN DE MANEJO DE ERRORES
console.log('\n🚨 8. VERIFICANDO MANEJO DE ERRORES...');

const archivosConErrores = [
  path.join(CLIENT_DIR, 'modules', 'WhatsAppWebChat.tsx'),
  path.join(CLIENT_DIR, 'modules', 'RealChatModule.tsx'),
  path.join(CLIENT_DIR, 'context', 'WhatsAppContext.tsx'),
  path.join(SERVER_DIR, 'index.js')
];

archivosConErrores.forEach(archivo => {
  const verif = verificarArchivo(archivo, 'errores');
  if (verif.existe && verif.contenido) {
    const nombre = path.basename(archivo);
    const manejoErrores = {
      'try/catch': verif.contenido.includes('try {') && verif.contenido.includes('catch'),
      'console.error': verif.contenido.includes('console.error'),
      'Error boundaries': verif.contenido.includes('ErrorBoundary') || verif.contenido.includes('componentDidCatch')
    };
    
    const erroresManejados = Object.entries(manejoErrores)
      .filter(([_, manejado]) => manejado)
      .map(([err, _]) => err);
    
    if (erroresManejados.length > 0) {
      resultados.optimizaciones.push(`✅ ${nombre}: Manejo de errores: ${erroresManejados.join(', ')}`);
    } else {
      resultados.warnings.push(`⚠️ ${nombre}: Manejo de errores limitado`);
    }
  }
});

// GENERAR REPORTE FINAL
console.log('\n📊 RESUMEN DE VERIFICACIÓN COMPLETA DEL SISTEMA');
console.log('='.repeat(60));

// Mostrar errores críticos
if (resultados.erroresCriticos.length > 0) {
  console.log('\n❌ ERRORES CRÍTICOS:');
  resultados.erroresCriticos.forEach(error => console.log(`  ${error}`));
}

// Mostrar optimizaciones
if (resultados.optimizaciones.length > 0) {
  console.log('\n✅ OPTIMIZACIONES DETECTADAS:');
  resultados.optimizaciones.forEach(opt => console.log(`  ${opt}`));
}

// Mostrar warnings
if (resultados.warnings.length > 0) {
  console.log('\n⚠️ ADVERTENCIAS:');
  resultados.warnings.forEach(warning => console.log(`  ${warning}`));
}

// Mostrar verificaciones exitosas
if (resultados.verificaciones.length > 0) {
  console.log('\n🔍 VERIFICACIONES EXITOSAS:');
  resultados.verificaciones.forEach(verif => console.log(`  ${verif}`));
}

// ESTADÍSTICAS FINALES
console.log('\n📈 ESTADÍSTICAS FINALES:');
console.log(`  • Errores críticos: ${resultados.erroresCriticos.length}`);
console.log(`  • Optimizaciones: ${resultados.optimizaciones.length}`);
console.log(`  • Advertencias: ${resultados.warnings.length}`);
console.log(`  • Verificaciones exitosas: ${resultados.verificaciones.length}`);

// RECOMENDACIONES
console.log('\n💡 RECOMENDACIONES PRIORITARIAS:');

if (resultados.erroresCriticos.length > 0) {
  console.log('  1. RESOLVER ERRORES CRÍTICOS INMEDIATAMENTE');
}

if (resultados.warnings.length > 5) {
  console.log('  2. ADDRESS WARNINGS PARA MEJORAR ESTABILIDAD');
}

// Verificar si hay problemas de rendimiento
const optimizacionesCount = resultados.optimizaciones.filter(opt => 
  opt.includes('useMemo') || opt.includes('useCallback') || opt.includes('React.memo')
).length;

if (optimizacionesCount < 3) {
  console.log('  3. IMPLEMENTAR MÁS OPTIMIZACIONES DE RENDIMIENTO EN REACT');
}

// Verificar manejo de archivos
const archivosMultimedia = resultados.verificaciones.filter(v => 
  v.includes('ModernMessageMedia')
).length;

if (archivosMultimedia === 0) {
  console.log('  4. VERIFICAR COMPLETAMENTE EL MANEJO DE ARCHIVOS MULTIMEDIA');
}

console.log('\n✅ VERIFICACIÓN COMPLETADA');
console.log('Revisa el reporte anterior para acciones específicas.');