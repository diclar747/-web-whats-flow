# 📱 Sistema de Estados de WhatsApp - SOLO DATOS REALES

## ✅ Estado Actual del Sistema

**TODOS los datos de prueba/demo han sido eliminados.**

El sistema ahora está configurado para capturar **ÚNICAMENTE estados REALES** de tus contactos de WhatsApp.

---

## 🔄 Cómo Funciona

### 1. **Captura Automática de Estados**

El servidor está escuchando mensajes de WhatsApp en tiempo real. Cuando un contacto publica un estado:

```javascript
// El servidor detecta mensajes tipo @broadcast (estados)
if (mensaje es de tipo @broadcast) {
    ✅ Extrae el JID del contacto
    ✅ Descarga el contenido (texto, imagen o video)
    ✅ Guarda en la tabla contact_statuses
    ✅ Emite evento Socket.IO al frontend
}
```

**Ubicación del código**: `/src/server/index.js` líneas 5750-5897

### 2. **Tipos de Estados Soportados**

- ✅ **Texto simple**: "Hola a todos"
- ✅ **Texto con emojis**: "Buenos días ☕🌅"
- ✅ **Imágenes**: Se descargan y guardan en `/media/statuses/`
- ✅ **Videos**: Se descargan y guardan en `/media/statuses/`

### 3. **Expiración Automática**

Los estados de WhatsApp expiran después de **24 horas** (igual que WhatsApp):
- Se guarda `expires_at = published_at + 24 horas`
- La API solo devuelve estados con `expires_at > NOW()`

---

## 📊 Verificar que el Sistema Está Escuchando

### Verificar sesiones activas:

```bash
sudo mysql -u root -e "
SELECT session_id, phone_number, status 
FROM whatsflow.whatsapp_sessions 
WHERE status = 'connected';
"
```

### Ver logs en tiempo real:

```bash
cd /var/www/web.whats-flow.com/src/server
pm2 logs whatsflow-server | grep -i "ESTADO\|STATUS\|BROADCAST"
```

Deberías ver mensajes como:
```
[sessionId] 📊 DETECTADOS: 1 ESTADOS DE WHATSAPP
[sessionId] 💾 Procesando estado de: 595981234567@s.whatsapp.net
[sessionId] ✅ Estado guardado: Juan Pérez - text - Buenos días!
```

---

## 🎯 Cuándo Verás Estados

Los estados aparecerán en la interfaz cuando:

1. ✅ **Tu sesión de WhatsApp está conectada**
   ```bash
   # Verificar
   curl http://localhost:3002/api/whatsapp/statuses/TU_SESSION_ID
   ```

2. ✅ **Tus contactos publican estados nuevos**
   - El sistema solo recibe estados que WhatsApp te comparte
   - Respeta la privacidad igual que la app de WhatsApp

3. ✅ **Los estados no han expirado** (menos de 24 horas)

---

## 🔍 Verificar Estados en la Base de Datos

### Ver todos los estados activos:

```bash
sudo mysql -u root -e "
SELECT 
    contact_name,
    text_content,
    media_type,
    TIME_FORMAT(TIMEDIFF(NOW(), published_at), '%H:%i') AS hace,
    TIME_FORMAT(TIMEDIFF(expires_at, NOW()), '%H:%i') AS expira_en
FROM whatsflow.contact_statuses
WHERE expires_at > NOW()
ORDER BY published_at DESC;
"
```

### Verificar si hay estados para tu sesión:

```bash
# Reemplaza TU_SESSION_ID con tu sessionId real
sudo mysql -u root -e "
SELECT 
    COUNT(*) as total_estados,
    COUNT(DISTINCT contact_jid) as total_contactos
FROM whatsflow.contact_statuses
WHERE session_id = 'TU_SESSION_ID' 
  AND expires_at > NOW();
"
```

---

## 🚨 Solución de Problemas

### ❌ "No hay estados disponibles"

**Causas posibles:**

1. **No hay estados en las últimas 24 horas**
   - Esto es normal si tus contactos no han publicado estados recientemente
   - Los estados se capturarán automáticamente cuando alguien publique uno

2. **Sesión desconectada**
   ```bash
   # Verificar estado de la sesión
   curl http://localhost:3002/api/whatsapp/session-status/TU_SESSION_ID
   ```

3. **Servidor no está escuchando**
   ```bash
   # Reiniciar servidor
   cd /var/www/web.whats-flow.com/src/server
   pm2 restart whatsflow-server
   pm2 logs whatsflow-server --lines 50
   ```

### 🔄 Forzar Descarga de Estados (Solo para Testing)

Si quieres probar que el sistema funciona, publica un estado desde tu teléfono:

1. Abre WhatsApp en tu teléfono
2. Ve a "Mi estado"
3. Publica un estado de prueba
4. Espera 10-30 segundos
5. Verifica en los logs:
   ```bash
   pm2 logs whatsflow-server | grep "Estado guardado"
   ```

---

## 📝 Base de Datos

### Tabla: `contact_statuses`

```sql
CREATE TABLE contact_statuses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(50) NOT NULL,
  message_id VARCHAR(255),
  contact_jid VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  avatar_url VARCHAR(1024),
  text_content TEXT,
  media_type ENUM('text','image','video'),
  media_url VARCHAR(1024),
  published_at DATETIME,
  expires_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Query útil para debugging:

```sql
-- Ver últimos estados recibidos (incluso expirados)
SELECT 
    contact_name,
    SUBSTRING(text_content, 1, 50) AS mensaje,
    media_type,
    published_at,
    expires_at,
    CASE 
        WHEN expires_at > NOW() THEN 'ACTIVO'
        ELSE 'EXPIRADO'
    END AS estado
FROM contact_statuses
ORDER BY published_at DESC
LIMIT 10;
```

---

## 🎯 Resumen

| Estado | ✅/❌ |
|--------|------|
| Datos demo eliminados | ✅ |
| Listener de estados activo | ✅ |
| API funcionando | ✅ |
| Frontend compilado | ✅ |
| Tabla BD lista | ✅ |
| Esperando estados reales | ⏳ |

**El sistema está 100% listo para recibir estados REALES de WhatsApp.**

Los estados aparecerán automáticamente cuando tus contactos los publiquen y tu sesión esté conectada.

---

## 📞 Contacto con el Sistema

**API Endpoint**: `GET /api/whatsapp/statuses/:sessionId`

**Respuesta cuando NO hay estados**:
```json
{
  "success": true,
  "statuses": [],
  "selfStatuses": [],
  "message": "No hay estados disponibles"
}
```

**Respuesta cuando HAY estados**:
```json
{
  "success": true,
  "statuses": [
    {
      "jid": "595981234567@s.whatsapp.net",
      "name": "Juan Pérez",
      "phone": "595981234567",
      "avatar": "/media/profile/595981234567.jpg",
      "statuses": [
        {
          "id": "ABC123...",
          "type": "text",
          "caption": "Buenos días! ☕",
          "timestamp": 1734235200000
        }
      ],
      "unreadCount": 1
    }
  ],
  "message": "1 contactos con estados"
}
```

---

**Última actualización**: 15 de diciembre de 2024, 02:18 UTC
**Estado**: Sistema activo, esperando estados reales de WhatsApp
