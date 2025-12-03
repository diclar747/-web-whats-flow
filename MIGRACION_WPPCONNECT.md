# 🔄 MIGRACIÓN DE BAILEYS A WPPCONNECT

## 📋 ESTADO ACTUAL
- **Baileys:** 7.0.0-rc.9
- **WPPConnect:** 1.37.8 (instalado)
- **Backup creado:** ✅ /var/www/backups/

## 🎯 CAMBIOS NECESARIOS

### 1. Imports (línea 8)
```javascript
// ANTES (Baileys):
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, downloadMediaMessage } = require('@whiskeysockets/baileys');

// DESPUÉS (WPPConnect):
const wppconnect = require('@wppconnect-team/wppconnect');
```

### 2. Crear sesión
```javascript
// ANTES (Baileys):
const { state, saveCreds } = await useMultiFileAuthState(authPath);
const sock = makeWASocket({...});

// DESPUÉS (WPPConnect):
const client = await wppconnect.create({
  session: sessionId,
  catchQR: (base64Qr, asciiQR) => {
    // Emitir QR
  },
  statusFind: (statusSession, session) => {
    // Estado de sesión
  }
});
```

### 3. Eventos de mensajes
```javascript
// ANTES (Baileys):
sock.ev.on('messages.upsert', async (m) => {...});

// DESPUÉS (WPPConnect):
client.onMessage(async (message) => {...});
client.onAnyMessage(async (message) => {...}); // Incluye mensajes propios
```

### 4. Enviar mensajes
```javascript
// ANTES (Baileys):
await sock.sendMessage(jid, { text: 'mensaje' });

// DESPUÉS (WPPConnect):
await client.sendText(jid, 'mensaje');
```

## ⏱️ PROGRESO
- [x] WPPConnect instalado
- [ ] Adaptar imports
- [ ] Adaptar creación de sesión
- [ ] Adaptar eventos de mensajes
- [ ] Adaptar envío de mensajes
- [ ] Adaptar descarga de media
- [ ] Probar conexión
- [ ] Probar mensajes

## 🚀 INICIO: 02/12/2025 23:44
