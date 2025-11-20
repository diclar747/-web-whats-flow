# Scripts de Limpieza de Base de Datos

Scripts para limpiar datos de sincronización de WhatsApp.

## 📋 Scripts Disponibles

### 1. clear_sync_data.js (Node.js) - RECOMENDADO

Script interactivo con confirmación y resumen detallado.

#### Limpiar TODOS los datos:
```bash
node db/scripts/clear_sync_data.js
```

Esperará 5 segundos antes de ejecutar para que puedas cancelar con Ctrl+C.

#### Limpiar solo un usuario específico:
```bash
node db/scripts/clear_sync_data.js +1234567890
```

**Salida de ejemplo**:
```
🔄 Conectando a la base de datos...
✅ Conectado a la base de datos

🗑️  Limpiando tabla messages...
   ✅ 3409 mensajes eliminados

🗑️  Limpiando tabla contacts...
   ✅ 951 contactos eliminados

📊 Resumen:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Mensajes eliminados:        3409
   Contactos eliminados:       951
   Grupos eliminados:          1
   Miembros eliminados:        0
   Broadcasts eliminados:      164
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Limpieza completada exitosamente
```

---

### 2. clear_sync_data.sql (SQL)

Script SQL directo sin confirmación.

```bash
mysql -u root -p whatsflow < db/scripts/clear_sync_data.sql
```

---

## 🔧 Endpoint API

También puedes usar el endpoint API desde cualquier cliente:

```bash
curl -X DELETE http://localhost:3001/sync/clear/+1234567890
```

---

## 📊 Datos que se Eliminan

Los scripts limpian:

1. ✅ **messages** - Todos los mensajes
2. ✅ **contacts** - Todos los contactos individuales
3. ✅ **contact_groups** - Todos los grupos de WhatsApp
4. ✅ **contact_group_members** - Relaciones contacto-grupo
5. ✅ **broadcasts** - Estados y newsletters

Y resetean en la tabla **users**:
- `auto_sync = FALSE`
- `sync_completed = FALSE`
- `last_sync_date = NULL`

---

## ⚠️ IMPORTANTE

- Los scripts usan `DELETE` no `TRUNCATE` para respetar llaves foráneas
- Las sesiones activas NO se eliminan (solo los datos sincronizados)
- Los archivos de autenticación NO se eliminan

---

## 🧪 Verificar que la limpieza funcionó

```bash
mysql -u root -p whatsflow -e "
SELECT
  'messages' AS tabla, COUNT(*) AS registros FROM messages
UNION ALL
SELECT 'contacts', COUNT(*) FROM contacts
UNION ALL
SELECT 'contact_groups', COUNT(*) FROM contact_groups;
"
```

Deberías ver todo en 0:
```
tabla            registros
messages         0
contacts         0
contact_groups   0
```

---

## 🔐 Configuración de Base de Datos

Los scripts usan esta configuración (puedes modificarla en cada archivo):

```javascript
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'WhatsFlow2024!',
  database: process.env.DB_NAME || 'whatsflow'
};
```

---

## 📚 Documentación Completa

Ver `SYNC_IMPROVEMENTS.md` en la raíz del proyecto para documentación completa.
