# Diagrama de Flujo - Transferencia de Chats (POST-FIXES)

## ✅ Flujo Completo de Transferencia

```
┌─────────────────────────────────────────────────────────────────┐
│                         ADMIN (Web UI)                          │
│  - Ver lista de chats                                           │
│  - Click derecho > Transferir a Agente                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  POST /api/chats/transfer                                       │
│  {                                                              │
│    sessionId: "UUID"                                            │
│    chatJid: "5512345678@s.whatsapp.net"                         │
│    toAgentId: 2,          ✅ FIX: Usado para identificar agente │
│    fromAgentId: null                                            │
│  }                                                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│            Backend: /api/chats/transfer Handler                 │
│                                                                 │
│  1. Obtiene data del agente de la BD                            │
│  2. Inserta asignación en chat_assignments tabla                │
│  3. Inserta notificación de sistema en messages                 │
│  4. Prepara transferData objeto                                 │
│  5. Emite eventos Socket.IO:                                    │
│     - io.emit('chat:transferred', transferData) [GLOBAL]        │
│     - io.to(`agent-${toAgentId}`).emit(...) ✅ SIN ESPACIOS     │
│     - io.to(`agent-${fromAgentId}`).emit(...) ✅ SIN ESPACIOS   │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    [EVENTO]         [EVENTO]       [EVENTO]
   chat:transferred  agent-2         agent-X
   (GLOBAL)        (SPECIFIC)      (FROM AGENT)
         │               │               │
         └───────────────┼───────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│            AGENT DASHBOARD (React/Socket.IO)                    │
│                                                                 │
│  ✅ Escucha: 'chat:transferred'                                 │
│     - handleTransferEvent:                                      │
│       1. Filtra: if (toAgentId === agentId)                     │
│       2. Reproduce notificación.mp3                             │
│       3. Muestra browser Notification                           │
│       4. Llama loadAgentChats()                                 │
│                                                                 │
│  loadAgentChats():                                              │
│     - Fetches POST /api/agent/chats/:agentId/:sessionId         │
│     - Obtiene asignaciones activas de chat_assignments          │
│     - Pone el chat en lista del agente                          │
│     - UI se actualiza en tiempo real                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Información Devuelta en cada paso

### 1️⃣ Admin hace transfer
```json
POST /api/chats/transfer
Body: {
  "sessionId": "f12a3b4c-5d6e-7f8g-9h0i-1j2k3l4m5n6o",
  "chatJid": "5512345678@s.whatsapp.net",
  "toAgentId": 2,
  "fromAgentId": null
}
```

### 2️⃣ Backend confirma transfer
```json
Response: {
  "success": true,
  "message": "Chat transferido exitosamente",
  "agentName": "Claudio",
  "chatName": "Juan García"
}
```

### 3️⃣ Backend emite eventos Socket.IO
```javascript
const transferData = {
  type: 'transfer',
  chatJid: '5512345678@s.whatsapp.net',
  sessionId: 'UUID',
  chatName: 'Juan García',
  avatar: null,
  phoneNumber: '5512345678',
  message: '📢 * Chat transferido por Admin *\n...',
  toAgentId: 2,          // ✅ Identifica agente destino
  fromAgentId: null,
  agentId: 2,            // ✅ Alternativa de toAgentId
  transferredFrom: null,
  playSound: true,
  showNotification: true,
  timestamp: '2025-12-07T16:42:35.123Z'
}
```

### 4️⃣ Agent Dashboard lo procesa
```javascript
const handleTransferEvent = (data) => {
  if (String(data.toAgentId) !== String(agentId)) return; // ✅ Filtro correcto
  
  console.log('🔄 Chat transferido a este agente:', data);
  
  // Sonido y notificación
  new Audio('/notification.mp3').play();
  new Notification('Chat transferido', {
    body: `Se te ha transferido el chat: ${data.chatName}`
  });
  
  // Recargar lista de chats
  loadAgentChats();
};
```

---

## 📊 Comparativa: ANTES vs DESPUÉS

| Aspecto | ANTES ❌ | DESPUÉS ✅ |
|--------|---------|----------|
| **Room Name** | `agent - {id}` (con espacios) | `agent-{id}` (correcto) |
| **Agent Status** | Siempre "online" | Real (offline/busy/online) |
| **Transfer Event** | No escuchado en Dashboard | Escuchado y procesado |
| **Chat aparece** | Nunca en Dashboard | Inmediatamente con notificación |
| **Socket Connection** | Falla silenciosamente | Conecta con room correcto |
| **Filtro de Agente** | N/A | Filtra por toAgentId === agentId |

---

## 🚀 Validación de Fixes

### Test 1: Endpoint Status
```bash
curl http://localhost:3002/api/agents/available
# Resultado esperado:
# "status": "offline" o "busy" o "online" (NO siempre "online")
```

### Test 2: Socket Rooms
```bash
# Buscar en logs:
grep "agent-" /tmp/whatsflow-backend.log | grep "📤 Evento emitido"
# Debe mostrar: agent-2 (sin espacios)
```

### Test 3: Agent Dashboard
```bash
# En consola del navegador del agente:
console.log('Escuchando: chat:transferred');
# Debería ver handleTransferEvent ejecutarse al recibir evento
```

---

## 📝 Logs Esperados en Backend

```
[TRANSFER] 📤 Evento emitido globalmente y a sala agent-2
[TRANSFER] 📤 Evento también emitido a agent-null
[TRANSFER] ✅ Chat 5512345678@s.whatsapp.net transferido al agente Claudio (ID: 2)
[TRANSFER] 📧 Notificación enviada al agente
```

---

## ⚡ Impacto de los Fixes

1. **Socket.IO Room Names:** Agentes reciben eventos en socket correcto
2. **Real Status:** Admins ven disponibilidad real antes de transferir
3. **Dashboard Listener:** Agentes notificados inmediatamente de nuevos chats
4. **UX Completo:** Flujo end-to-end funcional y transparente
