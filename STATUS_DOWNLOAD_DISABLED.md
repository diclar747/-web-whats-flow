# Descarga de Estados de WhatsApp - DESHABILITADA

## Cambios Aplicados - 23 Nov 2025

### 🚫 Estados/Status BLOQUEADOS Completamente

Se ha bloqueado completamente la descarga y sincronización de estados de WhatsApp (historias/status) en todas las partes del sistema.

### Cambios Realizados

#### 1. Filtro en Sincronización de Chats
**Ubicación**: `src/server/index.js` - Función `fullSyncDatabaseWithBaileys()`

```javascript
// Filtrar status/broadcast ANTES de procesar chats
chatArray = chatArray.filter(chat => {
    const chatId = chat.id || '';
    return !chatId.includes('@broadcast') && 
           !chatId.includes('status@') && 
           !chatId.includes('@lid');
});

// Doble verificación en el loop
for (const chat of chatArray) {
    if (chatId.includes('@broadcast') || chatId.includes('status@') || chatId.includes('@lid')) {
        console.log(`[FULL-SYNC] 🚫 Ignorando status/broadcast: ${chatId}`);
        continue;
    }
    // ... proceso normal
}
```

#### 2. Filtro en Sincronización de Contactos
**Ubicación**: `src/server/index.js` - Función `fullSyncDatabaseWithBaileys()`

```javascript
// Filtrar status/broadcast de contactos
contactList = contactList.filter(contact => {
    const contactId = contact.id || '';
    return !contactId.includes('@broadcast') && 
           !contactId.includes('status@') && 
           !contactId.includes('@lid');
});

// Doble verificación en el loop
for (const contact of contactList) {
    if (!contact.id || 
        contact.id.includes('@broadcast') || 
        contact.id.includes('status@') || 
        contact.id.includes('@lid')) {
        continue;
    }
    // ... proceso normal
}
```

#### 3. Filtro en Mensajes Entrantes
**Ubicación**: `src/server/index.js` - Evento `messages.upsert`

```javascript
// Contar y reportar status bloqueados
const statusMessages = m.messages.filter(msg => 
    msg.key?.remoteJid?.includes('@broadcast') || 
    msg.key?.remoteJid?.includes('status@')
);

if (statusMessages.length > 0) {
    console.log(`[SESSION] 🚫 BLOQUEADO: ${statusMessages.length} ESTADOS/STATUS - NO SE DESCARGAN`);
    statusMessages.forEach(msg => {
        console.log(`[SESSION] 🚫 Status ignorado de: ${msg.key?.remoteJid}`);
    });
}

// Filtrar mensajes
m.messages = m.messages.filter(msg => {
    const jid = msg.key?.remoteJid;
    
    // Rechazar status/estados
    if (jid.includes('@broadcast') || jid.includes('status@')) return false;
    
    // Rechazar @lid (canales)
    if (jid.includes('@lid')) return false;
    
    // Aceptar solo mensajes individuales
    return jid.includes('@s.whatsapp.net');
});
```

### Logs de Bloqueo

Cuando el sistema detecta y bloquea estados, verás estos mensajes en los logs:

```bash
# Log de bloqueo de estados
[SESSION] 🚫 BLOQUEADO: 5 ESTADOS/STATUS DE WHATSAPP - NO SE DESCARGAN NI SINCRONIZAN
[SESSION] 🚫 Status ignorado de: status@broadcast
[SESSION] 🚫 Status ignorado de: 595999999999@broadcast

# Log de sincronización (sin estados)
[FULL-SYNC] - Chats en store: 42 (sin estados ni broadcasts)
[FULL-SYNC] - Contactos en store: 150 (sin estados ni broadcasts)
[FULL-SYNC] 🚫 Ignorando status/broadcast: status@broadcast
```

### Qué Se Bloquea

1. **Estados de WhatsApp** (historias):
   - `status@broadcast`
   - Cualquier JID que contenga `@broadcast`
   - Cualquier JID que contenga `status@`

2. **Canales de WhatsApp**:
   - Cualquier JID que contenga `@lid`

3. **Broadcasts manuales**:
   - Cualquier tipo de broadcast

### Qué Se PERMITE

- ✅ Mensajes individuales normales (`@s.whatsapp.net`)
- ✅ Chats uno a uno
- ✅ Sincronización de contactos normales
- ❌ Grupos (ya estaban bloqueados previamente)
- ❌ Estados/Status
- ❌ Broadcasts
- ❌ Canales

### Verificación

Para verificar que no se están descargando estados:

```bash
# Monitorear logs en tiempo real
pm2 logs whatsflow-backend --lines 100

# Buscar bloqueos de status
pm2 logs whatsflow-backend --lines 200 | grep "BLOQUEADO\|Status ignorado"

# Verificar que no hay mensajes de status en la base de datos
mysql -u root -p'bUJ23$KlP9' whatsflow -e "
SELECT COUNT(*) as total_status_messages 
FROM messages 
WHERE chat_jid LIKE '%@broadcast%' OR chat_jid LIKE '%status@%';
"

# Verificar que no hay contactos de status
mysql -u root -p'bUJ23$KlP9' whatsflow -e "
SELECT COUNT(*) as total_status_contacts 
FROM contacts 
WHERE jid LIKE '%@broadcast%' OR jid LIKE '%status@%';
"
```

### Performance

**Antes del cambio**:
- Se descargaban y procesaban estados innecesariamente
- Mayor uso de CPU y memoria
- Base de datos con datos irrelevantes

**Después del cambio**:
- 🚫 Estados bloqueados completamente
- ✅ Mejor performance
- ✅ Base de datos más limpia
- ✅ Menos consumo de recursos

### Estado Actual

✅ Descarga de estados BLOQUEADA
✅ Filtros aplicados en todos los puntos críticos
✅ Logs informativos cuando se bloquea un estado
✅ Servidor reiniciado con cambios aplicados
✅ Sistema funcionando normalmente

### Si Aún Ves Notificaciones

Si aún ves alguna notificación relacionada con estados:

1. **Verifica los logs**:
   ```bash
   pm2 logs whatsflow-backend --lines 50
   ```

2. **Limpia caché del navegador**:
   - Ctrl + Shift + R (recarga forzada)
   - O limpia todo el caché del navegador

3. **Verifica la consola del navegador**:
   - F12 → Consola
   - Busca mensajes relacionados con "status" o "estados"

4. **Revisa eventos Socket.IO**:
   - En consola del navegador, busca eventos emitidos
   - Verifica que no lleguen mensajes de status

La notificación que viste probablemente era de una sincronización normal de "Descargando contactos..." o "Descargando chats...", pero ahora con los filtros aplicados, **NO se descargarán estados** en ninguna de esas sincronizaciones.

---

**Deploy**: Aplicado y funcionando
**Servidor**: Reiniciado con cambios
**Status**: ✅ Completado
