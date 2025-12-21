# Plan de Implementación: Usar user.id en lugar de phoneNumber en session_id

## Estado Actual (Dec 21, 2025)

Se ha completado la infraestructura base:
1. ✅ Función `getOwnerSessionId()` en index.js
2. ✅ Módulo `sessionIdResolver.js` con funciones helpers exportables
3. ✅ `saveMessageToDB()` actualizado para usar user.id
4. ✅ Endpoints `/sync/preference` actualizados en sync.js
5. ✅ personalizedCampaigns.js GET actualizado

## Pasos Siguientes

### Fase 1: Completar sync.js (1 archivo)
**Archivo:** src/server/routes/sync.js
**Línea:** ~115 en el endpoint POST `/force/:sessionId`

En la función principal, antes de hacer las inserciones:
```javascript
// Resolver sessionId a user.id
const { resolveToUserId } = require('../helpers/sessionIdResolver');
let ownerSessionId = await resolveToUserId(sessionId);
```

Luego reemplazar todos los `sessionId` con `ownerSessionId` en las inserciones:
- `INSERT INTO contacts (jid, name, session_id, ...` → usar `ownerSessionId`
- `INSERT INTO contact_groups (jid, name, session_id, ...` → usar `ownerSessionId`
- `UPDATE users SET sync_completed = TRUE WHERE` → buscar por `session_id = ?` si aplica

### Fase 2: Completar personalizedCampaigns.js (5 más endpoints)
**Archivo:** src/server/routes/personalizedCampaigns.js

Agregar al inicio de cada endpoint:
```javascript
const { resolveToUserId } = require('../helpers/sessionIdResolver');
let sessionId = await resolveToUserId(sessionId);
if (!sessionId) return res.status(400).json({ success: false, error: 'Invalid session' });
```

Endpoints a actualizar:
1. POST `/` (crear campaña)
2. PUT `/:id` (actualizar)
3. DELETE `/:id` (eliminar)
4. POST `/:id/execute` (ejecutar)
5. POST `/:id/schedule` (programar)

### Fase 3: Actualizar index.js endpoints principales
**Archivo:** src/server/index.js

Hay ~200+ líneas con endpoints que reciben sessionId. Prioridad:
1. GET `/api/chats` - listar chats
2. GET `/api/contacts` - listar contactos
3. GET `/api/sessions/active` - sesiones activas
4. POST endpoints para crear datos (campaigns, contacts, etc)
5. WebSocket handlers que usan sessionId

Patrón de actualización:
```javascript
app.get('/api/chats/:sessionId', async (req, res) => {
    let { sessionId } = req.params;
    const { getOwnerSessionId } = require('./path-to-helpers'); // o usar función inline
    sessionId = await getOwnerSessionId(sessionId);
    if (!sessionId) return res.status(400).json(...);
    
    // Usar sessionId resuelto en todas las queries
    const [chats] = await pool.query('SELECT * FROM chats WHERE session_id = ?', [sessionId]);
});
```

### Fase 4: Actualizar routes adicionales
Archivos que también necesitan resolveToUserId:
1. `src/server/routes/chatbot.js` - endpoints de chatbot
2. `src/server/routes/planRequests.js` - solicitudes de planes
3. `src/server/routes/clients.js` - clientes
4. `src/server/routes/messageTemplates.js` - templates
5. `src/server/analytics-endpoints.js` - analytics endpoints
6. `src/server/multiagent-endpoints.js` - endpoints multi-agente

### Fase 5: Datos Legacy (Opcional)
Ejecutar migraciones SQL para convertir phoneNumbers antiguos a user.id:

```sql
-- Para cada tabla, mapear session_id (phoneNumber) a session_id (user.id)
-- Esto solo es necesario si hay datos antiguos con phoneNumber

UPDATE messages m
SET m.session_id = (
    SELECT us.session_id 
    FROM user_sessions us 
    WHERE us.phone = m.session_id 
    LIMIT 1
)
WHERE m.session_id REGEXP '^[0-9]{6,15}$' 
  AND EXISTS (
    SELECT 1 FROM user_sessions us 
    WHERE us.phone = m.session_id
  );

-- Repetir para: contacts, chats, campaigns, etc.
```

## Testing

Después de cada fase:
1. Verificar que los datos se inserten con user.id correcto:
   ```bash
   mysql -u root -p"$MYSQL_PASSWORD" whatsflow -e "SELECT DISTINCT session_id FROM messages LIMIT 10;"
   ```

2. Verificar que las queries resuelvan correctamente:
   ```bash
   # En logs PM2:
   pm2 logs whatsflow-server | grep "RESOLVER\|resolveToUserId"
   ```

3. Probar endpoints con sessionId en diferentes formatos:
   - Email: `claudio@cnid.com.py`
   - PhoneNumber: `595991234567`
   - user.id: `29`

## Notas Importantes

1. **Compatibilidad Backward**: El helper `resolveToUserId()` soporta múltiples formatos (email, phone, user.id), así que no rompe código existente.

2. **Caché**: Si necesitas performance, agregar caché a `resolveToUserId()`:
   ```javascript
   const resolverCache = new Map();
   
   async function resolveToUserId(rawId) {
       if (resolverCache.has(rawId)) return resolverCache.get(rawId);
       const result = await ...; // lógica actual
       resolverCache.set(rawId, result);
       return result;
   }
   ```

3. **Eventos de emisión**: Las funciones de emisión de eventos (Socket.IO) ya usan `sessionId` para las salas (`session-${sessionId}`), que es correcto.

4. **Base de datos**: Todas las tablas ya tienen el campo `session_id`, solo necesita asegurarse que se guarde user.id en lugar de phoneNumber.

## Archivos Modificados Hasta Ahora
- src/server/index.js (getOwnerSessionId, saveMessageToDB)
- src/server/helpers/sessionIdResolver.js (nuevo)
- src/server/routes/sync.js (preference endpoints)
- src/server/routes/personalizedCampaigns.js (GET endpoint)
- src/client/src/App.tsx (setear sessionId = user.id)
- src/client/src/modules/WhatsAppConnectionModule.tsx (usar sessionId resuelto)

## Próximos Pasos Recomendados
1. Completar sync.js
2. Completar personalizedCampaigns.js
3. Actualizar endpoints principales de index.js
4. Testing integral
5. Migración de datos legacy (si es necesario)
