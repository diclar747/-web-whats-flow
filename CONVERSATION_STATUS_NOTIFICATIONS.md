# Sistema de Notificaciones de Estado de Conversación

## Implementación Completada - 23 Nov 2025

### Características Implementadas

#### 1. **Indicadores de Estado Visual en Avatares**
Cada avatar de chat del agente ahora muestra un círculo de color indicando el estado de la conversación:

- 🟡 **Amarillo** - Conversación activa (status: 'active')
- 🔴 **Rojo** - Conversación cerrada (status: 'closed')
- 🟢 **Verde** - Nueva asignación/transferencia (status: 'pending' o 'new_assignment')
- 🔵 **Azul** - Conversación transferida (status: 'transferred')

Los indicadores aparecen tanto en la vista minimizada como expandida de la lista de chats.

#### 2. **Opción "Cerrar Conversación"**
Se agregó un nuevo menú (3 puntos) en la cabecera del chat con la opción:
- **Cerrar Conversación**: Permite al agente cerrar la conversación actual
- Una vez cerrada, el chat muestra indicador rojo
- El agente NO puede seguir enviando mensajes
- Los inputs de texto, emojis y adjuntar archivos se deshabilitan
- Mensaje tooltip: "Conversación cerrada. Solicita al admin que la transfiera de nuevo."

#### 3. **Reapertura por Admin**
Cuando el admin transfiere un chat cerrado de vuelta al agente:
- El chat aparece con indicador **verde** (nueva asignación)
- El agente recibe notificación de nueva asignación
- Al enviar el primer mensaje, el estado cambia automáticamente a **amarillo** (activo)

#### 4. **Transición Automática de Estados**
- **pending → active**: Ocurre automáticamente cuando el agente envía su primer mensaje
- **closed → pending**: Cuando admin transfiere el chat de vuelta
- **pending → active**: El agente puede empezar a responder y el estado se actualiza

### Cambios Técnicos

#### Frontend (AgentDashboardPro.tsx)
```typescript
// Nueva interfaz con campos de estado
interface AgentChat {
  ...
  status?: 'active' | 'closed' | 'transferred' | 'new_assignment';
  closedAt?: string;
}

// Funciones para manejar estados
getConversationStatusColor(status)  // Retorna color según estado
getConversationStatusTooltip(status) // Retorna descripción del estado
handleCloseConversation() // Cierra la conversación

// Indicadores visuales en avatares
<Box sx={{ position: 'absolute', backgroundColor: getConversationStatusColor(status) }} />

// Deshabilitar inputs cuando está cerrado
disabled={selectedChat?.status === 'closed'}
```

#### Backend (index.js)

**Nuevo Endpoint**:
```javascript
POST /api/agent/close-conversation
Body: { agentId, chatJid, sessionId }
```

**Cambios en Base de Datos**:
- Tabla `chat_assignments`: Ya tenía campos `status` y `closed_at`
- Estados soportados: 'active', 'closed', 'pending', 'transferred'

**Actualización Automática de Estado**:
- En `/api/messages/send`: Cuando agente envía mensaje, actualiza `pending → active`
- En `/api/chats/transfer`: Nuevas asignaciones comienzan como `pending`

**Eventos Socket.IO**:
- `agent-${agentId}-conversation-closed`: Notifica cuando se cierra
- `conversation-status-changed`: Notifica cambios de estado
- `agent-${agentId}-new-chat`: Con status 'new_assignment'

### Base de Datos

**Tabla: chat_assignments**
```sql
status ENUM('active', 'closed', 'pending', 'transferred')
closed_at TIMESTAMP NULL
```

**Query de chats del agente**:
```sql
-- Ahora incluye todos los estados y los ordena por prioridad
WHERE status IN ('active', 'closed', 'pending')
ORDER BY 
  CASE 
    WHEN status = 'pending' THEN 1
    WHEN status = 'active' THEN 2
    WHEN status = 'closed' THEN 3
  END
```

### Flujo de Trabajo

1. **Chat Activo**:
   - Agente trabajando normalmente
   - Indicador amarillo 🟡
   - Puede enviar mensajes

2. **Agente Cierra Conversación**:
   - Click en menú (3 puntos) → "Cerrar conversación"
   - Estado cambia a 'closed'
   - Indicador rojo 🔴
   - Inputs deshabilitados
   - No puede enviar más mensajes

3. **Admin Transfiere Chat Cerrado**:
   - Admin selecciona chat y transfiere al agente
   - Estado cambia a 'pending'
   - Indicador verde 🟢
   - Notificación de nueva asignación
   - Agente puede ver el chat

4. **Agente Responde**:
   - Envía primer mensaje
   - Estado automáticamente cambia a 'active'
   - Indicador amarillo 🟡
   - Conversación normal continúa

### Archivos Modificados

1. `src/client/src/pages/AgentDashboardPro.tsx`
   - Interfaz AgentChat actualizada
   - Funciones de estado añadidas
   - Indicadores visuales en avatares
   - Menú "Cerrar conversación"
   - Deshabilitar inputs cuando cerrado
   - Mapeo de estados DB → Frontend

2. `src/server/index.js`
   - Endpoint POST `/api/agent/close-conversation`
   - Actualización automática pending→active en envío de mensajes
   - Query actualizado en GET `/api/agent/:userId/chats`
   - Transferencias comienzan como 'pending'
   - Eventos Socket.IO para notificaciones

3. `src/client/src/utils/api.ts` (nuevo)
   - Utilidad getAPIBaseURL()

### Testing

Para probar la funcionalidad:

1. Login como agente
2. Verificar indicador amarillo en chats activos
3. Abrir chat → Click 3 puntos → "Cerrar conversación"
4. Verificar indicador rojo y campos deshabilitados
5. Como admin, transferir ese chat de vuelta al agente
6. Verificar indicador verde y notificación
7. Enviar mensaje como agente
8. Verificar cambio automático a amarillo

### Notas

- Los estados son persistentes en la base de datos
- Los indicadores son visibles tanto en vista minimizada como expandida
- Tooltips descriptivos al pasar mouse sobre indicadores
- Sistema compatible con transferencias entre agentes
- No afecta funcionalidad existente de otros módulos
