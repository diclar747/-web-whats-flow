# Testing: Sistema de Notificaciones de Estado de Conversación

## Pasos para Probar la Funcionalidad

### 1. Login como Agente
```
URL: https://web.whats-flow.com/agent-login
```

### 2. Ver Indicadores de Estado

En el Dashboard del Agente, observa los círculos de colores en los avatares:

- **🟡 Amarillo**: Conversaciones activas normales
- **🔴 Rojo**: Conversaciones cerradas por el agente
- **🟢 Verde**: Nuevas asignaciones o transferencias pendientes

Los indicadores aparecen en la esquina inferior derecha de cada avatar, tanto en la vista minimizada como expandida.

### 3. Cerrar una Conversación

1. Selecciona un chat activo (amarillo)
2. Click en los 3 puntos (⋮) en la esquina superior derecha
3. Selecciona **"Cerrar conversación"**
4. Verifica que:
   - El indicador cambió a rojo 🔴
   - El input de texto está deshabilitado
   - El botón de emoji está deshabilitado
   - El botón de adjuntar archivo está deshabilitado
   - El botón de enviar está deshabilitado
   - Tooltip dice: "Conversación cerrada. Solicita al admin que la transfiera de nuevo."

### 4. Verificar Estado Cerrado

1. El chat permanece visible en la lista pero con indicador rojo
2. No puedes enviar mensajes
3. El menú muestra "Conversación cerrada" (deshabilitado)
4. Tooltip en el avatar indica "Conversación cerrada"

### 5. Reapertura por Admin (Prueba con otro usuario Admin)

Como Admin:
1. Ve al módulo de asignación de chats
2. Encuentra el chat cerrado
3. Transfiere el chat de vuelta al mismo agente

Como Agente:
1. Verifica que recibes notificación de nueva asignación
2. El chat ahora tiene indicador verde 🟢
3. Tooltip dice "Nueva asignación"
4. Los inputs están habilitados nuevamente

### 6. Reactivar Conversación

1. Con el chat verde (nueva asignación), envía un mensaje
2. El estado automáticamente cambia a amarillo 🟡 (activo)
3. La conversación ahora funciona normalmente

### 7. Verificar en Base de Datos

```sql
-- Ver estado de las asignaciones
SELECT 
    ca.id,
    ca.chat_jid,
    ca.user_id,
    ca.status,
    ca.assigned_at,
    ca.closed_at,
    u.name as agent_name
FROM chat_assignments ca
LEFT JOIN users u ON ca.user_id = u.id
WHERE ca.user_id = [AGENT_ID]
ORDER BY ca.assigned_at DESC
LIMIT 10;

-- Estados esperados:
-- 'pending' = nueva asignación (verde)
-- 'active' = conversación activa (amarillo)
-- 'closed' = cerrada por agente (rojo)
-- 'transferred' = transferida a otro agente (azul)
```

### 8. Pruebas de Socket.IO

Abre la consola del navegador y verifica los eventos:

```javascript
// Al cerrar conversación
agent-${agentId}-conversation-closed
conversation-status-changed

// Al transferir chat
agent-${agentId}-new-chat (con status: 'new_assignment')
chat:transferred
```

### 9. Casos Edge

#### Caso 1: Múltiples Chats Cerrados
- Cierra varios chats
- Todos deben mostrar indicador rojo
- Todos deben tener inputs deshabilitados

#### Caso 2: Transferencia entre Agentes
1. Agente A tiene chat activo (amarillo)
2. Admin transfiere a Agente B
3. Agente B recibe con indicador verde
4. Agente B envía mensaje → cambia a amarillo
5. Chat de Agente A desaparece o marca como transferido

#### Caso 3: Recarga de Página
1. Cierra un chat (rojo)
2. Recarga la página (F5)
3. Verifica que el estado persiste (sigue rojo)
4. Los inputs siguen deshabilitados

#### Caso 4: Vista Minimizada
1. Minimiza la lista de chats (click en el botón de minimizar)
2. Los indicadores de color deben seguir visibles
3. Tooltips deben mostrar nombre + estado

### 10. Verificar API Endpoints

#### Cerrar Conversación:
```bash
curl -X POST https://web.whats-flow.com/api/agent/close-conversation \
  -H "Authorization: Bearer [TOKEN]" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": 123,
    "chatJid": "595999999999@s.whatsapp.net",
    "sessionId": "595985768793"
  }'

# Respuesta esperada:
{
  "success": true,
  "message": "Conversación cerrada exitosamente"
}
```

#### Ver Chats del Agente:
```bash
curl https://web.whats-flow.com/api/agent/123/chats?sessionId=595985768793 \
  -H "Authorization: Bearer [TOKEN]"

# Respuesta incluye:
{
  "success": true,
  "chats": [
    {
      "chat_jid": "...",
      "status": "active|closed|pending|transferred",
      "closed_at": "2025-11-23T18:00:00Z" // si está cerrado
    }
  ]
}
```

### Checklist Final

- [ ] Indicadores de color visibles en ambas vistas (expandida/minimizada)
- [ ] Cerrar conversación funciona correctamente
- [ ] Inputs se deshabilitan al cerrar
- [ ] Estado persiste después de recargar página
- [ ] Admin puede transferir chats cerrados
- [ ] Chat transferido aparece verde (nueva asignación)
- [ ] Primer mensaje cambia estado a activo (amarillo)
- [ ] Tooltips informativos en todos los estados
- [ ] Eventos Socket.IO se emiten correctamente
- [ ] Base de datos refleja cambios de estado
- [ ] No hay errores en consola del navegador
- [ ] No hay errores en logs del servidor (pm2 logs)

### Troubleshooting

**Problema**: Indicadores no aparecen
- Solución: Verificar que el campo `status` llega desde el backend
- Check: Consola del navegador → buscar objeto chat

**Problema**: No puedo cerrar conversación
- Solución: Verificar permisos del agente
- Check: El botón debe estar habilitado en el menú

**Problema**: Estado no persiste
- Solución: Verificar actualización en base de datos
- Check: Ejecutar query SQL de verificación

**Problema**: Notificación no aparece
- Solución: Verificar conexión Socket.IO
- Check: Consola del navegador → "Socket conectado"

### Logs a Monitorear

```bash
# Ver logs en tiempo real
pm2 logs whatsflow-backend --lines 50

# Buscar eventos específicos
pm2 logs whatsflow-backend | grep "AGENT.*conversation"
pm2 logs whatsflow-backend | grep "closed"
```

## Estado Actual
✅ Sistema implementado y desplegado
✅ Build exitoso
✅ Servidor reiniciado
✅ Base de datos configurada
✅ Endpoints funcionando

Listo para pruebas en producción.
