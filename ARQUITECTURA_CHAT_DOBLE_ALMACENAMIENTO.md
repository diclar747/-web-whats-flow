# Arquitectura de Chat con Doble Almacenamiento

## 📋 Descripción General

Este sistema implementa una arquitectura de **doble almacenamiento** para optimizar el rendimiento de la interfaz del chat de WhatsApp.

### **Problema que Resuelve**

Cuando se conecta un número de WhatsApp con mucho historial, la tabla `messages` crece enormemente, causando:
- Lentitud en la carga del chat
- Timeouts en consultas
- Interfaz de usuario poco responsiva

### **Solución Implementada**

Separar los datos en dos tablas especializadas:

| Tabla | Propósito | Contenido |
|-------|-----------|-----------|
| `messages` | Histórico completo | TODOS los mensajes (descarga en segundo plano) |
| `chat` | Interfaz de chat | Solo mensajes recientes/nuevos (UI rápida) |

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ARQUITECTURA DEL SISTEMA                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────┐         ┌──────────────────┐                     │
│  │  WHATSAPP WEB    │────────▶│   TABLA CHAT     │◄─────┐              │
│  │  (Baileys)       │         │  (Interfaz UI)   │      │              │
│  └──────────────────┘         └──────────────────┘      │              │
│           │                              ▲              │              │
│           │                              │              │              │
│           │    MENSAJES NUEVOS           │              │              │
│           │    (Tiempo real)             │              │              │
│           │                              │              │              │
│           ▼                              │              │              │
│  ┌──────────────────┐                    │              │              │
│  │  TABLA MESSAGES  │────────────────────┘              │              │
│  │  (Histórico      │   Sincronización                   │              │
│  │   Completo)      │   selectiva                        │              │
│  └──────────────────┘                                  │              │
│           ▲                                            │              │
│           │                                            │              │
│           │    SINCRONIZACIÓN EN SEGUNDO PLANO         │              │
│           │    (Todo el historial del teléfono)        │              │
│           │                                            │              │
│  ┌────────┴─────────┐                                  │              │
│  │  SYNC WORKER     │                                  │              │
│  │  (Background)    │──────────────────────────────────┘              │
│  └──────────────────┘         Interfaz del Chat (Rápida)              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Componentes del Sistema

### 1. **Tabla `messages`** (Histórico Completo)

Almacena TODO el historial de mensajes descargado del teléfono.

**Características:**
- Todos los mensajes históricos
- Grupos, broadcasts, individuales
- Datos completos de multimedia
- Relación con contactos

**Uso:**
- Reportes históricos
- Exportación de datos
- Búsqueda completa
- Análisis de datos

### 2. **Tabla `chat`** (Interfaz Optimizada)

Almacena solo mensajes recientes para la interfaz de chat.

**Características:**
- Solo mensajes de los últimos 90 días (configurable)
- Índices optimizados para consultas frecuentes
- Sin datos históricos masivos
- UI ultra-rápida

**Estructura:**
```sql
CREATE TABLE chat (
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
);
```

### 3. **Sync Worker** (`src/server/syncWorker.js`)

Servicio que descarga el historial completo en segundo plano.

**Funciones:**
- Se ejecuta automáticamente al conectar WhatsApp
- Descarga mensajes históricos de todos los chats
- Guarda en tabla `messages` (no en `chat`)
- No bloquea la interfaz del usuario

**Características:**
- Procesamiento por lotes
- Reintentos automáticos
- Progreso en tiempo real (Socket.IO)
- Múltiples métodos de obtención

### 4. **Chat Cleanup Service** (`src/server/chatCleanup.js`)

Mantiene la tabla `chat` optimizada eliminando mensajes antiguos.

**Funciones:**
- Limpieza automática diaria (3:00 AM)
- Retención configurable (default: 90 días)
- Eliminación por lotes (evita bloqueos)
- Estadísticas de tabla

---

## 🔄 Flujo de Datos

### Cuando llega un mensaje nuevo:

1. **Baileys** recibe el mensaje (`messages.upsert`)
2. **saveMessageToDB()** guarda en:
   - `messages` (histórico completo)
   - `chat` (interfaz rápida)
3. **Socket.IO** emite a los clientes conectados
4. **UI** muestra el mensaje inmediatamente

### Cuando se conecta WhatsApp:

1. **WhatsApp se conecta** (`connection === 'open'`)
2. **Sync Worker** inicia después de 5 segundos
3. **Sync Worker** descarga historial completo:
   - Obtiene lista de chats
   - Descarga mensajes de cada chat
   - Guarda en `messages` (histórico)
4. **La interfaz** sigue usando `chat` (mensajes recientes)
5. **Usuario** puede usar el chat inmediatamente

---

## 🚀 Endpoints Disponibles

### Sync Worker

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/sync/start/:sessionId` | POST | Inicia sincronización manual |
| `/api/sync/status/:sessionId` | GET | Obtiene estado de sync |
| `/api/sync/stats` | GET | Estadísticas globales de sync |

### Chat Cleanup

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/chat/stats` | GET | Estadísticas de tabla chat |
| `/api/chat/cleanup` | POST | Limpieza manual (admin) |

---

## ⚙️ Configuración

### Sync Worker (`src/server/syncWorker.js`)

```javascript
const SYNC_CONFIG = {
    batchSize: 100,           // Mensajes por lote
    batchDelay: 100,          // ms entre lotes
    maxConcurrent: 2,         // Syncs simultáneos
    maxRetries: 3,            // Reintentos por lote
    progressInterval: 50      // Emitir progreso cada X msgs
};
```

### Chat Cleanup (`src/server/chatCleanup.js`)

```javascript
const CLEANUP_CONFIG = {
    retentionDays: 90,        // Días de retención
    batchSize: 10000,         // Máximo por ejecución
    executionHour: 3,         // Hora (3 AM)
    executionMinute: 0,
    enabled: true
};
```

---

## 📝 Migración de Datos

Para migrar datos existentes:

```bash
# Ejecutar migración SQL
mysql -u usuario -p base_de_datos < migrations/002_create_chat_table.sql
```

Esta migración:
1. Crea la tabla `chat`
2. Migra mensajes de los últimos 30 días
3. Mantiene el historial completo en `messages`

---

## 🎯 Beneficios

### Rendimiento
- **Consultas 10x más rápidas** en la interfaz del chat
- **Menor uso de memoria** en el servidor
- **Sin timeouts** al cargar chats

### Escalabilidad
- **Tabla `messages`** puede crecer sin límite
- **Tabla `chat`** siempre se mantiene pequeña
- **Historial completo** disponible para reportes

### UX
- **Chat carga instantáneamente**
- **Mensajes nuevos** aparecen en tiempo real
- **Historial completo** accesible vía exportación

---

## 🔧 Mantenimiento

### Verificar estado del sistema:

```bash
# Estadísticas de sync
curl -H "Authorization: Bearer TOKEN" \
  https://api.tu-dominio.com/api/sync/stats

# Estadísticas de tabla chat
curl -H "Authorization: Bearer TOKEN" \
  https://api.tu-dominio.com/api/chat/stats
```

### Limpieza manual:

```bash
# Limpiar mensajes de más de 60 días
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"days": 60}' \
  https://api.tu-dominio.com/api/chat/cleanup
```

---

## 🐛 Troubleshooting

### Problema: Tabla `chat` no existe
**Solución:** Ejecutar migración SQL
```bash
mysql -u usuario -p base_de_datos < migrations/002_create_chat_table.sql
```

### Problema: Sync Worker no inicia
**Verificar:**
1. Sesión de WhatsApp está conectada
2. No hay otro sync en progreso (`/api/sync/status/:sessionId`)
3. Logs del servidor para errores

### Problema: Mensajes no aparecen en el chat
**Verificar:**
1. Mensajes se guardan en `messages` (revisar logs)
2. Mensajes se guardan en `chat` (revisar logs `[DB-CHAT]`)
3. Endpoint `/api/messages` usa tabla `chat`

---

## 📊 Monitoreo

### Métricas importantes:

| Métrica | Query SQL |
|---------|-----------|
| Total mensajes (histórico) | `SELECT COUNT(*) FROM messages` |
| Total mensajes (chat) | `SELECT COUNT(*) FROM chat` |
| Mensajes por día | `SELECT DATE(timestamp), COUNT(*) FROM messages GROUP BY DATE(timestamp)` |
| Tamaño de tablas | `SELECT table_name, ROUND((data_length + index_length) / 1024 / 1024, 2) AS size_mb FROM information_schema.tables WHERE table_schema = DATABASE()` |

---

## 🔒 Consideraciones de Seguridad

1. **Sync Worker** requiere autenticación para iniciar manualmente
2. **Chat Cleanup** solo administradores pueden ejecutar manualmente
3. **Todas las operaciones** se registran en logs
4. **Rate limiting** aplica a endpoints de sync

---

## 🚀 Próximas Mejoras

- [ ] Sincronización selectiva (solo chats activos)
- [ ] Compresión de mensajes antiguos
- [ ] Archivado automático a storage frío
- [ ] Replicación de `messages` para analytics

---

## 📞 Soporte

Para reportar problemas o sugerir mejoras:
1. Revisar logs del servidor (`[SYNC-WORKER]`, `[DB-CHAT]`, `[CHAT-CLEANUP]`)
2. Verificar métricas en endpoints de stats
3. Contactar al equipo de desarrollo
