# ⚡ INSTRUCCIONES RÁPIDAS - Sistema Corregido

## ✅ LO QUE SE CORRIGIÓ:

1. **Base de datos limpiada** - Todos los grupos y miembros eliminados
2. **Session_id del agente actualizado** - Ahora usa la sesión activa del admin
3. **Sistema compilado y desplegado** - Última versión en producción

## 🎯 CÓMO PROBAR AHORA:

### 🔴 IMPORTANTE: El agente DEBE cerrar sesión completamente

```bash
# 1. Como agente, ir a:
https://web.whats-flow.com/login

# 2. Iniciar sesión con:
Email: claudio@cnid.com.py
Password: 1234567

# 3. AHORA el sessionId será el correcto: ba54b5791a832a2a
```

## 📋 ESTADO ACTUAL:

| Componente | Estado | Detalles |
|-----------|---------|----------|
| Base de Datos | ✅ Limpia | 0 grupos, tablas optimizadas |
| Sesión Admin | ✅ Activa | Session: ba54b5791a832a2a |
| Sesión Agente | ✅ Sincronizada | Usa sesión del admin |
| API `/users/4/session` | ✅ OK | Devuelve session correcto |
| Chats Asignados | ✅ 1 activo | Chat con "Asucop" |
| Frontend | ✅ Desplegado | Build: main.07ff8750.js |
| Servidor | ✅ Online | PM2 running |

## 🐛 SI EL AGENTE SIGUE SIN FUNCIONAR:

### Paso 1: Limpiar completamente la sesión del agente

```bash
# Ejecutar en el servidor:
mysql -u root -p'S1d3r@l2o24$$' whatsflow -e "
DELETE FROM user_sessions 
WHERE phone_number IN (
    SELECT admin_phone FROM users WHERE role = 'agent'
);
"
```

### Paso 2: El agente debe:

1. **Cerrar TODAS las pestañas** de WhatsFlow
2. **Borrar caché del navegador** (Ctrl+Shift+Del)
3. **Abrir en ventana de incógnito**: https://web.whats-flow.com/login
4. **Iniciar sesión** con `claudio@cnid.com.py` / `1234567`
5. **Verificar** que va a `/dashboard` y no a `/login`

### Paso 3: Transferir un chat desde el admin

```
Admin → Dashboard → Chats → Seleccionar chat → ⋮ → "Transferir a Agente" → Seleccionar "claudio"
```

### Paso 4: Verificar que el agente lo recibe

El agente debería ver:
- ✅ Una lista de chats asignados
- ✅ El chat transferido aparece en la lista
- ✅ Al hacer clic, se abre el chat
- ✅ Se pueden ver los mensajes
- ✅ Se puede enviar un mensaje

## 🔍 VERIFICAR EN TIEMPO REAL:

### En el servidor, ver logs:
```bash
pm2 logs whatsflow-server --lines 100 | grep -E "AGENT|TRANSFER"
```

### En el navegador del agente (Consola F12):
```javascript
// Buscar estos mensajes:
"✅ SessionId desde BD:"
"🔌 Socket conectado"
"📨 Nuevo chat asignado:"
"[AGENT-SEND] 📤 Enviando mensaje:"
```

## ❌ SI APARECE ERROR: "Sesión de WhatsApp no disponible"

Significa que el `sessionId` que está usando el agente no tiene una conexión activa a WhatsApp.

**Solución:**
```bash
# Verificar qué sessionId está usando el agente:
mysql -u root -p'S1d3r@l2o24$$' whatsflow -e "
SELECT id, name, session_id FROM users WHERE role = 'agent';
"

# Debe coincidir con la sesión activa del admin:
mysql -u root -p'S1d3r@l2o24$$' whatsflow -e "
SELECT session_id, phone_number, is_active 
FROM user_sessions 
WHERE phone_number = '595985768793' AND is_active = 1;
"

# Si NO coinciden, ejecutar:
mysql -u root -p'S1d3r@l2o24$$' whatsflow -e "
UPDATE users u
INNER JOIN user_sessions s ON s.phone_number = u.admin_phone AND s.is_active = 1
SET u.session_id = s.session_id
WHERE u.role = 'agent';
"
```

## 📞 COMANDOS ÚTILES:

### Reiniciar servidor:
```bash
pm2 restart whatsflow-server
```

### Ver estado:
```bash
bash /var/www/web.whats-flow.com/CHECK_SYSTEM_STATUS.sh
```

### Ver chats asignados:
```bash
mysql -u root -p'S1d3r@l2o24$$' whatsflow -e "
SELECT ca.*, c.name 
FROM chat_assignments ca
LEFT JOIN contacts c ON c.jid = ca.chat_jid
WHERE ca.user_id = 4 AND ca.status = 'active';
"
```

### Limpiar chats asignados (SOLO SI ES NECESARIO):
```bash
mysql -u root -p'S1d3r@l2o24$$' whatsflow -e "
UPDATE chat_assignments SET status = 'closed' WHERE user_id = 4;
"
```

## 🎉 CUANDO TODO FUNCIONE:

Deberías poder:
1. ✅ Transferir chats del admin al agente
2. ✅ El agente ve los chats en su panel
3. ✅ El agente puede abrir y leer mensajes
4. ✅ El agente puede enviar mensajes
5. ✅ Los mensajes llegan a WhatsApp
6. ✅ Las respuestas llegan al agente en tiempo real

---

**Última actualización:** 2025-11-21 04:20:00 UTC  
**Build actual:** main.07ff8750.js  
**Session admin activa:** ba54b5791a832a2a  
**Session agente sincronizada:** ✅ ba54b5791a832a2a
