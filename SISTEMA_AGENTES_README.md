# Sistema de Agentes - WhatsFlow

## Estado Actual: 21 de Noviembre 2025

### ✅ Funcionalidades Implementadas

1. **Gestión de Agentes**
   - Creación y gestión de usuarios agentes
   - Asignación de permisos por módulos
   - Dashboard dedicado para agentes en `/dashboard`

2. **Sistema de Permisos**
   - Permisos granulares por módulo
   - Control de acceso: view, create, edit, delete
   - Interfaz moderna para asignar privilegios

3. **Transferencia de Chats**
   - Los admin pueden transferir chats a agentes
   - Registro en base de datos (tabla `chat_assignments`)
   - Notificaciones al agente cuando se asigna un chat

### ⚠️ Requisitos Importantes

#### Sesión de WhatsApp Activa del Admin

**MUY IMPORTANTE**: Los agentes NO tienen su propia sesión de WhatsApp. Los agentes usan la sesión de WhatsApp del administrador para enviar mensajes.

**Esto significa que:**
- El administrador DEBE tener WhatsApp conectado y activo
- Los agentes envían mensajes a través de la cuenta del admin
- Si el admin cierra su sesión de WhatsApp, los agentes NO podrán enviar mensajes

**Flujo Técnico:**
1. Agente inicia sesión con su email/contraseña
2. Sistema busca el `admin_phone` asociado al agente en la tabla `users`
3. Sistema busca la sesión activa del admin en `user_sessions`
4. Agente usa el `sessionId` del admin para enviar mensajes

### 🔧 Configuración de Agentes

#### Crear un Agente

1. Ir a **Configuración** → **Gestión de Agentes**
2. Clic en **Registrar Nuevo Agente**
3. Completar formulario:
   - Nombre
   - Email (será su usuario de login)
   - Contraseña
   - Departamento
   - Categoría
4. El sistema asigna automáticamente el `admin_phone` del admin actual

#### Asignar Permisos

1. En la lista de agentes, clic en el icono de permisos (🔑)
2. Se abre modal con módulos disponibles
3. Seleccionar módulos a los que el agente tendrá acceso
4. Guardar cambios

### 📋 Estructura de Base de Datos

#### Tabla `users`
```sql
- id
- name
- email
- password (encriptado)
- role ('admin' o 'agent')
- admin_phone (para agentes: número del admin)
- session_id (solo para admin)
- status ('active' o 'inactive')
```

#### Tabla `user_permissions`
```sql
- id
- user_id (FK a users.id)
- permission_name
- module
- can_view
- can_create
- can_edit
- can_delete
```

#### Tabla `chat_assignments`
```sql
- id
- chat_jid
- session_id
- user_id (FK a users.id)
- status ('active', 'completed', 'transferred')
- assigned_at
- notes
```

### 🐛 Problemas Conocidos y Soluciones

#### 1. "Sesión de WhatsApp no disponible"

**Causa**: El admin no tiene WhatsApp conectado

**Solución**: 
- El administrador debe ir a la página principal
- Escanear el código QR de WhatsApp
- Mantener la sesión activa

#### 2. Agente no recibe chats transferidos

**Verificar**:
- Socket.IO está conectado (verificar en consola del navegador)
- El admin ha transferido correctamente el chat
- El chat_assignment está en la base de datos con status='active'

**Revisar logs**:
```bash
pm2 logs whatsflow-server --lines 50
```

#### 3. Interfaz del agente se recarga constantemente

**Causa**: Token de autenticación expira o es inválido

**Solución**:
- Cerrar sesión y volver a iniciar
- Verificar que el token se guarda en sessionStorage

### 🚀 Próximas Mejoras Pendientes

1. **Interfaz del Agente**
   - [ ] Diseño estilo WhatsApp Web (lista lateral + panel de chat)
   - [ ] Soporte para envío de imágenes/videos/archivos
   - [ ] Emojis y formato de texto
   - [ ] Vista previa de medios

2. **Notificaciones**
   - [ ] Sonido de notificación mejorado
   - [ ] Notificaciones de escritorio más robustas
   - [ ] Badge con contador de chats pendientes

3. **Estadísticas**
   - [ ] Métricas de rendimiento por agente
   - [ ] Tiempo de respuesta promedio
   - [ ] Satisfacción del cliente

4. **Sesiones Independientes** (Largo plazo)
   - [ ] Permitir que cada agente tenga su propia sesión de WhatsApp
   - [ ] Multi-device soporte para múltiples agentes simultáneos

### 📞 Contactos de Prueba

**Admin Principal**: 595985768793
**Agente de Prueba**: claudio@cnid.com.py / contraseña: 1234567

### 🔐 Seguridad

- Todas las contraseñas se almacenan encriptadas con bcrypt
- Tokens de autenticación base64 con timestamp
- Validación de permisos en cada request
- Sesiones únicas por pestaña (sessionStorage)

### 📚 Documentación Técnica

**Endpoints Principales**:
- `POST /api/auth/login` - Login agente/admin
- `GET /api/users/:userId/session` - Obtener sessionId del admin
- `GET /api/agents/:userId/chats` - Obtener chats asignados
- `POST /api/messages/send` - Enviar mensaje (agente usa sessionId del admin)
- `POST /api/chat-assignments` - Asignar chat a agente

**Eventos Socket.IO**:
- `agent-{agentId}-new-chat` - Nuevo chat asignado
- `chat-assignment-changed` - Cambio en asignación
- `message:received` - Mensaje entrante
- `message-sent` - Confirmación de envío

---

**Última actualización**: 21 de Noviembre 2025
**Versión**: 1.0.0
**Estado**: Funcional (con limitaciones en interfaz de agente)
