const fs = require('fs');
const path = require('path');

console.log('🔍 VERIFICACIÓN COMPLETA DEL SISTEMA WHATSFLOW\n');

// Leer archivo principal del servidor
const serverFile = fs.readFileSync('./src/server/index.js', 'utf8');

// 1. Verificar eventos Socket.IO duplicados
console.log('=== 1. EVENTOS SOCKET.IO DUPLICADOS ===');
const socketEvents = {};
const eventRegex = /io\.(emit|to\([^)]+\)\.emit)\(['"]([^'"]+)['"]/g;
let match;
while ((match = eventRegex.exec(serverFile)) !== null) {
    const eventName = match[2];
    if (!socketEvents[eventName]) {
        socketEvents[eventName] = [];
    }
    socketEvents[eventName].push(match[0]);
}

Object.entries(socketEvents).forEach(([event, occurrences]) => {
    if (occurrences.length > 1) {
        console.log(`🔴 ${event}: ${occurrences.length} ocurrencias`);
    } else {
        console.log(`✅ ${event}: 1 ocurrencia`);
    }
});

// 2. Verificar endpoints HTTP duplicados
console.log('\n=== 2. ENDPOINTS HTTP DUPLICADOS ===');
const endpoints = {};
const endpointRegex = /app\.(get|post|put|delete)\(['"]([^'"]+)['"]/g;
while ((match = endpointRegex.exec(serverFile)) !== null) {
    const method = match[1];
    const path = match[2];
    const key = `${method} ${path}`;
    if (!endpoints[key]) {
        endpoints[key] = [];
    }
    endpoints[key].push(match[0]);
}

Object.entries(endpoints).forEach(([endpoint, occurrences]) => {
    if (occurrences.length > 1) {
        console.log(`🔴 ${endpoint}: ${occurrences.length} ocurrencias`);
    } else {
        console.log(`✅ ${endpoint}: 1 ocurrencia`);
    }
});

// 3. Verificar funciones críticas
console.log('\n=== 3. FUNCIONES CRÍTICAS ===');
const criticalFunctions = [
    'getUserPhoneNumber',
    'saveMessageToDB',
    'loadChatListFromDB',
    'sendMessageToWhatsApp',
    'processIncomingMessage'
];

criticalFunctions.forEach(func => {
    const regex = new RegExp(`(function|const|async)\\s+${func}`, 'g');
    const matches = serverFile.match(regex);
    if (matches && matches.length > 0) {
        console.log(`✅ ${func}: ${matches.length} definición(es)`);
    } else {
        console.log(`🔴 ${func}: NO ENCONTRADA`);
    }
});

// 4. Verificar manejo de multimedia
console.log('\n=== 4. MANEJO DE MULTIMEDIA ===');
const mediaKeywords = [
    'downloadMediaMessage',
    'mediaUrl',
    'image',
    'video',
    'audio',
    'document',
    'sticker'
];

mediaKeywords.forEach(keyword => {
    const regex = new RegExp(keyword, 'gi');
    const matches = serverFile.match(regex);
    if (matches && matches.length > 0) {
        console.log(`✅ ${keyword}: ${matches.length} referencias`);
    } else {
        console.log(`🔴 ${keyword}: NO ENCONTRADO`);
    }
});

// 5. Verificar eventos de mensajes
console.log('\n=== 5. EVENTOS DE MENSAJES ===');
const messageEvents = [
    'messages.upsert',
    'messages.update',
    'message',
    'new-message',
    'message-status-update'
];

messageEvents.forEach(event => {
    const regex = new RegExp(event, 'g');
    const matches = serverFile.match(regex);
    if (matches && matches.length > 0) {
        console.log(`✅ ${event}: ${matches.length} referencias`);
    } else {
        console.log(`🔴 ${event}: NO ENCONTRADO`);
    }
});

console.log('\n=== RESUMEN DE VERIFICACIÓN ===');
console.log('Se han identificado posibles problemas en el sistema:');
console.log('- Eventos Socket.IO duplicados pueden causar mensajes repetidos');
console.log('- Endpoints duplicados pueden causar conflictos');
console.log('- Verificar que todas las funciones críticas estén implementadas');
console.log('- Revisar el flujo de mensajes entre sesiones diferentes');
console.log('- Optimizar eventos para reducir duplicación');