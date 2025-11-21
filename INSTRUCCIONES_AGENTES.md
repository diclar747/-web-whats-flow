# INSTRUCCIONES PARA USAR EL SISTEMA DE AGENTES

## ⚠️ IMPORTANTE: PASOS OBLIGATORIOS

### 1. EL ADMIN DEBE CONECTAR WHATSAPP PRIMERO ✅

**Sin esto, los agentes NO pueden enviar mensajes**

1. El admin (595985768793) debe ir a: https://web.whats-flow.com
2. Iniciar sesión con su cuenta admin
3. Escanear el código QR de WhatsApp
4. Esperar a que diga "Conectado"

**Solo después de esto, los agentes pueden funcionar.**

---

## 2. CREAR Y CONFIGURAR AGENTES

### Crear un Agente:
1. Como admin, ir a: https://web.whats-flow.com/dashboard/settings
2. En la pestaña "Usuarios y Agentes"
3. Click en "Agregar Usuario"
4. Completar:
   - Nombre: claudio
   - Email: claudio@cnid.com.py
   - Contraseña: 1234567
   - Rol: Agent
   - Departamento: gestion

### Asignar Permisos:
1. En la lista de usuarios, buscar el agente
2. Click en el ícono de permisos (escudo o llave)
3. Se abrirá un modal
4. Seleccionar los módulos que el agente puede acceder:
   - ✅ Chat
   - ✅ Contactos
   - ✅ Respuestas (si necesita)

---

## 3. INICIAR SESIÓN COMO AGENTE

1. Ir a: https://web.whats-flow.com/login
2. Ingresar:
   - Email: claudio@cnid.com.py
   - Contraseña: 1234567
3. Click en "Iniciar Sesión"
4. El sistema lo redirige a: https://web.whats-flow.com/dashboard

---

## 4. TRANSFERIR CHATS A AGENTES

### Como Admin:

1. Ir al módulo de Chat: https://web.whats-flow.com/dashboard/chat
2. Seleccionar una conversación
3. Click en los 3 puntos (⋮) en la esquina superior derecha
4. Seleccionar "Transferir a agente"
5. Elegir el agente (claudio)
6. Confirmar

**El chat ahora aparecerá en el dashboard del agente.**

---

## 5. AGENTE RESPONDE MENSAJES

### Como Agente (claudio):

1. Iniciar sesión en https://web.whats-flow.com/login
2. Ir al dashboard
3. Ver los chats asignados en la lista
4. Click en un chat para abrirlo
5. Escribir el mensaje
6. Click en enviar (o Enter)

**El mensaje se enviará desde el WhatsApp del admin.**

---

## 6. VERIFICAR QUE TODO FUNCIONA

### Verificar Conexión del Admin:
```bash
sudo mysql whatsflow -e "SELECT session_id, phone_number, is_active FROM user_sessions WHERE phone_number = '595985768793';"
```

**Debe mostrar `is_active = 1`**

### Verificar Configuración del Agente:
```bash
sudo mysql whatsflow -e "SELECT id, name, email, admin_phone, session_id FROM users WHERE email = 'claudio@cnid.com.py';"
```

**El `admin_phone` debe ser `595985768793`**
**El `session_id` debe coincidir con el del admin activo**

### Ver Logs en Tiempo Real:
```bash
pm2 logs whatsflow-server --lines 50
```

Buscar mensajes como:
- `[AGENT-SEND] ✅ Mensaje enviado a WhatsApp`
- `[AGENT-SEND] ❌ Error...` (si hay problemas)

---

## 7. SOLUCIÓN DE PROBLEMAS

### Problema: "Sesión de WhatsApp no disponible"

**Causa:** El admin no está conectado a WhatsApp

**Solución:**
1. El admin debe escanear el QR nuevamente
2. Esperar a que conecte
3. Reintentar desde el agente

### Problema: "Token inválido"

**Causa:** La sesión del agente expiró

**Solución:**
1. Cerrar sesión
2. Volver a iniciar sesión

### Problema: Los mensajes no aparecen en el dashboard del agente

**Causa:** Socket no conectado o chat no transferido correctamente

**Solución:**
1. Refrescar la página del agente (F5)
2. Verificar que el chat esté transferido:
```bash
sudo mysql whatsflow -e "SELECT * FROM chat_assignments WHERE user_id = 4;"
```

### Actualizar Session ID del Agente Manualmente:

Si el agente no puede enviar mensajes, sincronizar el session_id:

```bash
# 1. Obtener session_id activo del admin
ADMIN_SESSION=$(sudo mysql whatsflow -N -e "SELECT session_id FROM user_sessions WHERE phone_number = '595985768793' AND is_active = 1 LIMIT 1;")

# 2. Actualizar el agente
sudo mysql whatsflow -e "UPDATE users SET session_id = '$ADMIN_SESSION' WHERE id = 4;"

# 3. Verificar
sudo mysql whatsflow -e "SELECT id, name, session_id FROM users WHERE id = 4;"
```

---

## 8. FLUJO COMPLETO DEL SISTEMA

```
1. ADMIN CONECTA WHATSAPP
   ↓
2. Se crea session_id (ej: "17028d336c0ed235")
   ↓
3. Se guarda en user_sessions (is_active = 1)
   ↓
4. AGENTE INICIA SESIÓN
   ↓
5. Obtiene session_id del admin
   ↓
6. ADMIN TRANSFIERE CHAT AL AGENTE
   ↓
7. AGENTE VE EL CHAT EN SU DASHBOARD
   ↓
8. AGENTE ESCRIBE Y ENVÍA MENSAJE
   ↓
9. Backend busca sesión del admin en memoria
   ↓
10. Envía mensaje por WhatsApp del admin
   ↓
11. Mensaje aparece en la conversación
```

---

## 9. CARACTERÍSTICAS DEL SISTEMA

### ✅ Lo que funciona:
- Múltiples agentes
- Transferencia de chats
- Envío de mensajes desde agentes
- Notificaciones de nuevos chats
- Historial de conversaciones
- Permisos por módulo

### ⚠️ Limitaciones actuales:
- Los agentes usan el WhatsApp del admin (no tienen conexión propia)
- Si el admin cierra WhatsApp, los agentes no pueden enviar
- Una conversación solo puede estar asignada a un agente a la vez

---

## 10. COMANDOS ÚTILES

### Ver todos los agentes:
```bash
sudo mysql whatsflow -e "SELECT id, name, email, department, status FROM users WHERE role = 'agent';"
```

### Ver chats asignados:
```bash
sudo mysql whatsflow -e "SELECT ca.*, u.name as agent_name FROM chat_assignments ca LEFT JOIN users u ON ca.user_id = u.id WHERE ca.status = 'active';"
```

### Desasignar un chat:
```bash
sudo mysql whatsflow -e "UPDATE chat_assignments SET status = 'completed' WHERE id = CHAT_ASSIGNMENT_ID;"
```

### Reiniciar servidor:
```bash
pm2 restart whatsflow-server
```

---

## CONTACTO Y SOPORTE

Si algo no funciona:

1. Revisa los logs: `pm2 logs whatsflow-server`
2. Verifica la conexión de WhatsApp del admin
3. Confirma que el agente tenga permisos asignados
4. Verifica que el chat esté transferido correctamente

---

**Última actualización:** 21 de noviembre de 2025
**Versión del sistema:** 1.0
