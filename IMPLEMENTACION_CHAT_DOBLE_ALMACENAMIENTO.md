# Guía de Implementación - Chat con Doble Almacenamiento

## 📋 Resumen de Cambios

Esta implementación añade una arquitectura de **doble almacenamiento** para optimizar el rendimiento del chat de WhatsApp.

---

## ✅ Checklist de Implementación

### Paso 1: Backup de Base de Datos

```bash
# Crear backup antes de cualquier cambio
mysqldump -u root -p nombre_base_de_datos > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Paso 2: Aplicar Cambios en el Código

Los siguientes archivos han sido modificados/creados:

1. ✅ `src/server/db/dbSetup.js` - Creación de tabla `chat`
2. ✅ `src/server/index.js` - Integración completa
3. ✅ `src/server/syncWorker.js` - Nuevo (descarga en segundo plano)
4. ✅ `src/server/chatCleanup.js` - Nuevo (limpieza automática)
5. ✅ `migrations/002_create_chat_table.sql` - Migración SQL

### Paso 3: Crear Tabla `chat`

```sql
-- Ejecutar en la base de datos
CREATE TABLE IF NOT EXISTS chat (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    chat_jid VARCHAR(255) NOT NULL,
    sender_jid VARCHAR(255),
    from_me BOOLEAN NOT NULL,
    message_type VARCHAR(50),
    text_content TEXT,
    media_url VARCHAR(1024),
    media_mime_type VARCHAR(100),
    timestamp DATETIME NOT NULL,
    status VARCHAR(50) DEFAULT 'received',
    is_read BOOLEAN DEFAULT FALSE,
    sender_name VARCHAR(255),
    sender_pushname VARCHAR(255),
    agent_id INT,
    agent_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_session_chat (session_id, chat_jid),
    INDEX idx_session_timestamp (session_id, timestamp),
    INDEX idx_timestamp (timestamp),
    INDEX idx_chat_timestamp (chat_jid, timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Paso 4: Migrar Datos Existentes

```sql
-- Migrar mensajes recientes (últimos 30 días)
INSERT INTO chat (
    id, session_id, chat_jid, sender_jid, from_me,
    message_type, text_content, media_url, media_mime_type,
    timestamp, status, is_read, sender_name, sender_pushname,
    agent_id, agent_name
)
SELECT 
    m.id,
    m.session_id,
    m.chat_jid,
    m.sender_jid,
    m.from_me,
    m.message_type,
    m.text_content,
    m.media_url,
    m.media_mime_type,
    m.timestamp,
    m.status,
    m.is_read,
    m.sender_name,
    NULL as sender_pushname,
    m.agent_id,
    m.agent_name
FROM messages m
WHERE m.timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    AND m.id NOT IN (SELECT id FROM chat WHERE id IS NOT NULL)
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    is_read = VALUES(is_read),
    sender_name = VALUES(sender_name),
    agent_id = VALUES(agent_id),
    agent_name = VALUES(agent_name),
    updated_at = CURRENT_TIMESTAMP;
```

### Paso 5: Reiniciar Servidor

```bash
# Detener servidor actual
pm2 stop whatsapp-api

# O si usas otro método
# kill -9 $(lsof -t -i:3000)

# Reiniciar servidor
pm2 start ecosystem.config.js
# o
npm start
```

---

## 🔍 Verificación Post-Implementación

### 1. Verificar Tabla Creada

```sql
-- Verificar que la tabla existe
SHOW TABLES LIKE 'chat';

-- Verificar estructura
DESCRIBE chat;

-- Verificar índices
SHOW INDEX FROM chat;
```

### 2. Verificar Datos Migrados

```sql
-- Contar mensajes en tabla chat
SELECT COUNT(*) as total_chat FROM chat;

-- Contar mensajes en tabla messages
SELECT COUNT(*) as total_messages FROM messages;

-- Ver rango de fechas en chat
SELECT 
    MIN(timestamp) as primer_mensaje,
    MAX(timestamp) as ultimo_mensaje
FROM chat;
```

### 3. Probar Endpoints

```bash
# Obtener estadísticas de sync
curl -H "Authorization: Bearer TU_TOKEN" \
  http://localhost:3000/api/sync/stats

# Obtener estadísticas de chat
curl -H "Authorization: Bearer TU_TOKEN" \
  http://localhost:3000/api/chat/stats

# Obtener mensajes (debería usar tabla chat)
curl -H "Authorization: Bearer TU_TOKEN" \
  "http://localhost:3000/api/messages?contactId=NUMERO@s.whatsapp.net&limit=50"
```

### 4. Verificar Logs

```bash
# Buscar logs de inicialización
tail -f server.log | grep -E "(CHAT-CLEANUP|SYNC-WORKER|DB-CHAT)"
```

Deberías ver:
```
[INIT] ✅ Chat Cleanup Service inicializado
[DB-CHAT] ✅ Mensaje guardado en tabla chat: ABC123...
[SYNC-WORKER] 🚀 Iniciando sincronización de historial...
```

---

## 🚨 Rollback (en caso de problemas)

### Si necesitas revertir los cambios:

```sql
-- 1. Eliminar tabla chat (opcional)
DROP TABLE IF EXISTS chat;

-- 2. El sistema automáticamente usará messages como fallback
--    (ver endpoint /api/messages - tiene lógica de fallback)
```

---

## ⚙️ Configuración Personalizada

### Cambiar días de retención en Chat Cleanup

Editar: `src/server/chatCleanup.js`

```javascript
const CLEANUP_CONFIG = {
    retentionDays: 90,    // Cambiar a valor deseado
    batchSize: 10000,
    executionHour: 3,
    executionMinute: 0,
    enabled: true
};
```

### Cambiar configuración de Sync Worker

Editar: `src/server/syncWorker.js`

```javascript
const SYNC_CONFIG = {
    batchSize: 100,       // Mensajes por lote
    batchDelay: 100,      // ms entre lotes
    maxConcurrent: 2,     // Syncs simultáneos
    maxRetries: 3,        // Reintentos
    progressInterval: 50  // Progreso cada X mensajes
};
```

---

## 📊 Monitoreo Continuo

### Queries útiles para monitoreo:

```sql
-- Tamaño de tablas
SELECT 
    table_name,
    ROUND((data_length + index_length) / 1024 / 1024, 2) AS size_mb,
    table_rows
FROM information_schema.tables
WHERE table_schema = DATABASE()
    AND table_name IN ('messages', 'chat')
ORDER BY size_mb DESC;

-- Mensajes por día (últimos 7 días)
SELECT 
    DATE(timestamp) as fecha,
    COUNT(*) as total
FROM messages
WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY DATE(timestamp)
ORDER BY fecha DESC;

-- Distribución de mensajes en chat
SELECT 
    DATE(timestamp) as fecha,
    COUNT(*) as total
FROM chat
GROUP BY DATE(timestamp)
ORDER BY fecha DESC
LIMIT 10;

-- Chats más activos
SELECT 
    chat_jid,
    COUNT(*) as mensajes,
    MAX(timestamp) as ultimo_mensaje
FROM chat
GROUP BY chat_jid
ORDER BY mensajes DESC
LIMIT 10;
```

---

## 🐛 Solución de Problemas Comunes

### Problema: "Tabla 'chat' no existe"

**Causa:** La tabla no se creó correctamente

**Solución:**
```bash
# Ejecutar SQL manualmente
mysql -u root -p nombre_base_de_datos < migrations/002_create_chat_table.sql
```

### Problema: "No se guardan mensajes en chat"

**Causa:** Error en saveMessageToDB

**Verificación:**
```bash
# Buscar errores en logs
grep -E "DB-CHAT|DB-MSG" server.log | tail -50
```

**Solución:**
- Verificar que la tabla existe
- Verificar permisos de BD
- Reiniciar servidor

### Problema: "Sync Worker no inicia"

**Verificación:**
```bash
# Verificar estado
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/sync/status/SESSION_ID
```

**Solución:**
- Verificar que WhatsApp está conectado
- Iniciar manualmente:
```bash
curl -X POST -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/sync/start/SESSION_ID
```

### Problema: "La tabla chat crece demasiado"

**Verificación:**
```bash
# Verificar estadísticas
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/chat/stats
```

**Solución:**
```bash
# Ejecutar limpieza manual
curl -X POST -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"days": 60}' \
  http://localhost:3000/api/chat/cleanup
```

---

## 📞 Contacto y Soporte

Si encuentras problemas durante la implementación:

1. Revisar logs del servidor
2. Verificar queries de monitoreo
3. Consultar documentación: `ARQUITECTURA_CHAT_DOBLE_ALMACENAMIENTO.md`
4. Contactar al equipo de desarrollo

---

## ✅ Confirmación de Implementación

Marca cuando completes cada paso:

- [ ] Backup de base de datos creado
- [ ] Código actualizado en servidor
- [ ] Tabla `chat` creada
- [ ] Datos migrados (mínimo últimos 30 días)
- [ ] Servidor reiniciado
- [ ] Logs verificados (sin errores)
- [ ] Endpoints probados y funcionando
- [ ] Prueba de envío/recepción de mensajes exitosa
- [ ] Rendimiento de chat verificado (rápido)

---

**Fecha de implementación:** ___________

**Responsable:** ___________

**Notas adicionales:**

