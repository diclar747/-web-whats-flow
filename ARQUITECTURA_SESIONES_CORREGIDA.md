# Arquitectura de Sesiones Corregida

## Tablas y Campos

### `users`
- `id` (PK): Identificador del usuario
- `email`: Email único
- `phone`: Teléfono del usuario (puede ser NULL inicialmente)
- `session`: Flag 1=login activo, 0=logout

### `user_sessions`
- `id` (PK): Auto-increment
- **`session_id`** (FK `users.id`): El ID del usuario que inició sesión ← **CRÍTICO**
- `phone`: Número de teléfono WhatsApp conectado
- `owner_phone_number`: Identificador alternativo
- `email`: Email del usuario
- **`is_active`** (1 | 0): Indica si hay conexión WhatsApp activa EN MEMORIA
- `device_id`: Dispositivo/navegador
- `session_token`: Token para validación
- `is_connected`: Flag de conexión (redundante con `is_active`, pero útil para UI)
- `last_activity`: Última actividad
- `last_connection_time`: Último login a WhatsApp

## Flujo de Login

```
1. Usuario entra email + contraseña
   → Buscar user.id en tabla users
   → Generar JWT con user.id

2. Frontend obtiene sessionId (user.id) del JWT
   → Almacena en sessionStorage

3. Usuario va a /dashboard/kanban
   → Frontend consulta GET /api/kanban/contacts/:sessionId (donde sessionId = user.id)
   → Backend mapea user.id → phone (de user_sessions)
   → Devuelve contactos asociados a ese user.id
```

## Flujo de Conexión WhatsApp

```
1. Generar QR con Baileys
   → Session ID temporal (hex)

2. Usuario escanea QR
   → Se conecta a WhatsApp
   → Socket se establece

3. Backend guarda en `user_sessions`:
   ✅ session_id = user.id (del usuario logueado)
   ✅ phone = número de WhatsApp
   ✅ is_active = 1
   ✅ owner_phone_number = identificador (puede ser user.id también)

4. Datos de contactos/mensajes se guardan con:
   ✅ session_id = user.id
   (Así todo está filtrado por usuario, no por línea)
```

## Flujo de Desconexión

```
1. Usuario cierra WhatsApp en el teléfono
   → Baileys emite evento 'connection.update' con status=LoggedOut

2. Backend ejecuta:
   ✅ UPDATE user_sessions SET is_active = 0
      WHERE session_id = user.id

3. Frontend verifica estado:
   GET /api/session/status?sessionId=user.id
   → Backend responde: isConnected = false

4. UI muestra "WhatsApp desconectado"
   → Usuario escanea nuevo QR o reconecta
```

## Consultas Correctas

### Obtener estado de una sesión de usuario
```sql
SELECT is_active, phone, owner_phone_number 
FROM user_sessions 
WHERE session_id = ? 
  AND is_active = 1 
LIMIT 1;
```

### Obtener contactos de un usuario
```sql
SELECT jid, name, avatar_url 
FROM contacts 
WHERE session_id = ?;
```

### Obtener mensajes de un usuario
```sql
SELECT * 
FROM messages 
WHERE session_id = ?;
```

### Obtener tableros Kanban de un usuario
```sql
SELECT id, name, color 
FROM kanban_boards 
WHERE session_id = ?;
```

## Mapeos en Backend

La función `getUserPhoneNumber(sessionId)` debe:
1. Si `sessionId` es un número (user.id):
   → Buscar en `user_sessions` por `session_id = ?`
   → Devolver el campo `phone`

2. Si `sessionId` es un hex (antigua sesión):
   → Mapear a user.id mediante tabla de conversión
   → Luego aplicar la lógica anterior

## Estados del Dashboard

| `is_active` | En memoria | Mostrar en UI |
|-----------|-----------|--------------|
| 1 | Sí | ✅ Conectado |
| 1 | No | ⚠️ Reconectar (bug) |
| 0 | N/A | ❌ Desconectado |

**Importante**: El backend es la fuente de verdad. Si `is_active=1` pero no hay sesión en memoria, es un inconsistencia que debe corregirse automáticamente.
