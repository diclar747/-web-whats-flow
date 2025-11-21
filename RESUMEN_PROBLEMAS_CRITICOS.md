# Resumen de Problemas Críticos - WhatsFlow

## ✅ COMPLETADO

### 1. Limpieza de Base de Datos
- ✅ Base de datos limpiada completamente
- ✅ Eliminados: mensajes, chats, grupos, contactos WhatsApp, campañas, asignaciones
- ✅ Conservados: usuarios, agentes, configuraciones, planes

## ❌ PROBLEMAS PENDIENTES

### 2. Sistema de Agentes - NO FUNCIONA
**Problema Principal:** Los agentes no pueden enviar mensajes porque:
- No hay sesión de WhatsApp activa en el servidor (`sessions.get(sessionId)` retorna null)
- El admin debe tener WhatsApp conectado para que los agentes puedan usar el sistema
- Cuando el agente intenta enviar mensaje a través de `POST /api/messages/send`, el endpoint verifica:
  ```javascript
  const session = sessions.get(sessionId);
  if (!session || !session.sock || !session.isConnected) {
      return res.status(400).json({ error: 'Sesión de WhatsApp no disponible' });
  }
  ```

**SOLUCIÓN REQUERIDA:**
1. El admin DEBE conectar WhatsApp primero en https://web.whats-flow.com/
2. Solo después los agentes podrán recibir y responder chats transferidos
3. Los mensajes de agentes se envían a través de la sesión de WhatsApp del admin

### 3. Interfaz de Agente - Necesita Mejoras
**Problemas:**
- ✅ Los chats transferidos SÍ llegan al agente
- ❌ El panel del agente recarga constantemente
- ❌ No muestra avatares ni nombres correctos de contactos
- ❌ Interfaz muy simple, debería ser como WhatsApp Web
- ❌ Faltan notificaciones en tiempo real
- ❌ Archivo de sonido notification.mp3 no se puede reproducir

**Ubicación del código:**
- `/var/www/web.whats-flow.com/src/client/src/pages/AgentDashboard.tsx`

### 4. Error en Asignación de Planes
**Error:** `POST https://web.whats-flow.com/api/subscriptions/activate?phone=595994854167` → HTTP 500

**Revisar:** Endpoint de activación de suscripciones en `/src/server/index.js`

### 5. Error en Crear Categoría de Citas
**Error:** `POST https://web.whats-flow.com/api/appointment-categories` → HTTP 500

**Revisar:** Tabla `appointment_categories` existe pero endpoint tiene error

### 6. Error en Asignar Privilegios a Agentes
**Error:** `PUT https://web.whats-flow.com/api/users/4/permissions` → HTTP 500
**Mensaje:** "Table 'whatsflow.user_permissions' doesn't exist"

**SOLUCIÓN:** Crear la tabla `user_permissions` en la base de datos

### 7. Campaña de Broadcast No Envía
**Problema:** Las campañas se ejecutan pero no envían mensajes
**Posible causa:** Sin sesión de WhatsApp activa, no se pueden enviar mensajes

### 8. Problema con Nombres de Contactos
**Problema:** Cuando el admin responde a un contacto, muestra el nombre del admin sobre el avatar del contacto
**Ejemplo:** Laura Vázquez Toniolo (+595 975 599676) aparece como "#diclar"

### 9. CRM - Orden de Pestañas
**Requerido:** En https://web.whats-flow.com/dashboard/crm
1. WhatsApp Contactos (primera pestaña por defecto)
2. WhatsApp Grupos
3. Contactos Locales
4. Grupos Locales

### 10. Kanban - Ajuste de Pantalla
**Problema:** Los tableros no se ajustan al 100% del ancho de pantalla
**Solución:** Configurar Grid para máximo 5 columnas que ocupen todo el ancho

### 11. Nueva Cita - Búsqueda por Nombre
**Requerido:**
- Buscar contacto por nombre (no por número)
- Al seleccionar nombre, cargar automáticamente el número
- Orden: Nombre arriba, Número abajo

### 12. Editar Contacto desde CRM
**Requerido:** Agregar opción "Editar" en el menú de 3 puntos de contactos
- Permitir editar nombre y número
- Usar modal moderno (no alert de navegador)

### 13. Chatbot - Error al Crear Flujo
**Error:** `POST https://web.whats-flow.com/api/chatbot/flows/595985768793` → HTTP 500

### 14. Sincronización de Chats
**Problema:** Los chats y mensajes no se sincronizan correctamente
**Causa:** No hay sesión de WhatsApp conectada

## 🔧 ACCIONES INMEDIATAS NECESARIAS

### PASO 1: Conectar WhatsApp (CRÍTICO)
```bash
1. Ir a https://web.whats-flow.com/
2. Escanear código QR con el teléfono del admin (595985768793)
3. Verificar que diga "✅ Conectado"
```

### PASO 2: Crear tabla user_permissions
```sql
CREATE TABLE IF NOT EXISTS user_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    module_name VARCHAR(100) NOT NULL,
    can_view BOOLEAN DEFAULT TRUE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_module (user_id, module_name)
);
```

### PASO 3: Revisar/Arreglar Endpoints con Error 500
- `/api/subscriptions/activate`
- `/api/appointment-categories`
- `/api/chatbot/flows/:phone`
- `/api/users/:id/permissions`

### PASO 4: Mejorar Interfaz de Agente
- Rediseñar AgentDashboard.tsx para parecerse a WhatsApp Web
- Agregar columna de chats a la izquierda
- Área de mensajes a la derecha
- Mostrar avatares y nombres correctos
- Eliminar recargas constantes
- Implementar actualización en tiempo real via Socket.IO

## 📋 CONFIGURACIÓN GIT

**Repositorio:** https://github.com/diclar747/-web-whats-flow

Para subir cambios:
```bash
cd /var/www/web.whats-flow.com
git add .
git commit -m "Descripción de cambios"
git push origin main
```

## 📝 NOTAS

- La base de datos está limpia y lista
- El sistema funcional depende de tener WhatsApp conectado
- Los agentes DEBEN esperar a que el admin conecte WhatsApp primero
- Muchos errores 500 son por falta de validación de sesión activa
