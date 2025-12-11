# 📋 Sistema Completo de Gestión de Planes y Suscripciones

## ✅ Resumen del Sistema Implementado

Se ha implementado un sistema completo de gestión de planes y suscripciones que permite:

1. **Clientes** pueden ver los planes disponibles y solicitar uno
2. **Super Admin** (595994854167) puede aprobar o rechazar solicitudes desde el Panel Admin
3. Al aprobar, el plan se activa automáticamente en `user_sessions`
4. El sistema muestra información de pago al cliente al solicitar un plan

---

## 🗂️ Archivos Creados/Modificados

### Backend (Servidor)

1. **`/src/server/routes/planRequests.js`** ✅ NUEVO
   - Endpoints para solicitar planes (POST /api/plan-requests)
   - Endpoints para aprobar/rechazar solicitudes (PUT /api/plan-requests/:id/approve, /reject)
   - Endpoint para ver mi solicitud (GET /api/plan-requests/my-request)
   - Endpoint admin para ver todas las solicitudes (GET /api/plan-requests)

2. **`/src/server/routes/subscriptions.js`** ✅ MODIFICADO
   - Endpoint `/activate` ahora funciona con `user_sessions`
   - Busca primero en `user_sessions`, luego en `users`
   - Soporta activación con teléfono o userId

3. **`/src/server/index.js`** ✅ MODIFICADO
   - Registra las rutas de `planRequests` (línea 269)

### Frontend (Cliente)

4. **`/src/client/src/components/AdminSubscriptionPanel.tsx`** ✅ MODIFICADO
   - Nuevo tab "Solicitudes" para ver solicitudes pendientes
   - Botones para Aprobar/Rechazar solicitudes
   - Diálogo para ingresar motivo de rechazo
   - Carga automática de solicitudes pendientes

5. **`/src/client/src/components/PlanSelector.tsx`** ✅ NUEVO
   - Vista de planes disponibles con precios
   - Botón "Solicitar Plan" para cada plan
   - Muestra información de pago al solicitar
   - Muestra estado de solicitud (pendiente/aprobada/rechazada)

### Base de Datos

6. **`create_plan_requests.sql`** ✅ NUEVO
   - Crea tabla `plan_requests` para almacenar solicitudes

7. **`SETUP_PLAN_SYSTEM.sql`** ✅ NUEVO
   - Script completo para configurar todo el sistema
   - Agrega campos de suscripción a `user_sessions`
   - Inserta planes de ejemplo
   - Incluye consultas útiles para administración

---

## 🚀 Pasos para Configurar el Sistema

### 1. Ejecutar el Script SQL

```bash
cd /var/www/web.whats-flow.com
mysql -u root -pWhatsFlow2024! whatsflow < SETUP_PLAN_SYSTEM.sql
```

Este script:
- Crea la tabla `plan_requests`
- Agrega campos de suscripción a `user_sessions`
- Inserta planes de ejemplo (Básico, Estándar, Premium)

### 2. Reiniciar el Servidor

```bash
cd /var/www/web.whats-flow.com/src/server
pm2 restart whatsflow-server
# o
pm2 restart all
```

### 3. Recompilar el Frontend (si es necesario)

```bash
cd /var/www/web.whats-flow.com/src/client
npm run build
```

---

## 📱 Flujo de Uso

### Para el CLIENTE (usuario sin plan)

1. El cliente ingresa al sistema y **NO tiene plan asignado**
2. El sistema debe redirigirlo a la página de Configuración → Pestaña "Mi Plan"
3. En esa pestaña, se muestra el componente **`<PlanSelector />`** con los planes disponibles
4. El cliente selecciona un plan y hace clic en **"Solicitar Plan"**
5. Se muestra un alert con la información de pago:
   ```
   Solicitud enviada!

   Envíe su depósito de Gs. 80.000 al alias 3626142 – Banco UENO
   y cargue su comprobante de pago.

   El administrador revisará su solicitud pronto.
   ```
6. La solicitud queda en estado **"Pendiente"**

### Para el SUPER ADMIN (595994854167)

1. El admin ingresa al **Panel de Administrador** (Configuración → Panel Admin)
2. En el tab **"Solicitudes"**, ve todas las solicitudes pendientes
3. Para cada solicitud puede:
   - ✅ **Aprobar**: Activa el plan automáticamente en `user_sessions`
   - ❌ **Rechazar**: Marca como rechazada con un motivo

4. Al aprobar:
   - El plan se activa en `user_sessions` con fecha de inicio y fin
   - El usuario puede usar el sistema según su plan
   - La solicitud se marca como "aprobada"

---

## 🗄️ Estructura de Base de Datos

### Tabla `plan_requests`

```sql
CREATE TABLE plan_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    phone_number VARCHAR(20) NOT NULL,        -- Teléfono del solicitante
    plan_id INT NOT NULL,                     -- ID del plan solicitado
    plan_name VARCHAR(100) NOT NULL,          -- Nombre del plan
    plan_price DECIMAL(10,2) NOT NULL,        -- Precio del plan
    duration_days INT DEFAULT 30,             -- Duración en días
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP NULL,
    reviewed_by VARCHAR(20),                   -- Teléfono del admin que revisó
    rejection_reason TEXT,                     -- Motivo de rechazo (si aplica)
    FOREIGN KEY (plan_id) REFERENCES plans(id)
);
```

### Tabla `user_sessions` (campos agregados)

```sql
ALTER TABLE user_sessions ADD COLUMN:
    subscription_plan VARCHAR(100),
    subscription_status ENUM('active', 'inactive', 'expired', 'cancelled', 'trial'),
    subscription_start_date TIMESTAMP,
    subscription_end_date TIMESTAMP,
    subscription_days INT
```

---

## 🔗 Endpoints API

### Clientes

- **POST** `/api/plan-requests` - Solicitar un plan
  ```json
  {
    "phone": "595985768793",
    "planId": 1
  }
  ```

- **GET** `/api/plan-requests/my-request?phone=595985768793` - Ver mi solicitud

### Admin (requiere autenticación de admin)

- **GET** `/api/plan-requests?status=pending` - Ver solicitudes pendientes
- **PUT** `/api/plan-requests/:id/approve` - Aprobar solicitud
- **PUT** `/api/plan-requests/:id/reject` - Rechazar solicitud
  ```json
  {
    "reason": "Pago no recibido",
    "adminPhone": "595994854167"
  }
  ```

### Planes

- **GET** `/api/plans` - Listar todos los planes

---

## 🎨 Componentes Frontend

### `<PlanSelector />` (Para Clientes)

Uso en la página de configuración:

```tsx
import PlanSelector from '../components/PlanSelector';

// En tu componente de Settings/Configuración:
<PlanSelector userPhone={currentUserPhone} />
```

### `<AdminSubscriptionPanel />` (Para Super Admin)

Ya está integrado en el dashboard del admin. Ahora tiene 4 tabs:
1. **Usuarios** - Lista de usuarios con sus planes
2. **Planes** - CRUD de planes
3. **Solicitudes** ✨ NUEVO - Aprobar/Rechazar solicitudes
4. **Conexiones** - Sesiones activas

---

## 🔍 Consultas Útiles

### Ver solicitudes pendientes
```sql
SELECT * FROM plan_requests WHERE status = 'pending' ORDER BY requested_at DESC;
```

### Ver usuarios con planes activos
```sql
SELECT
    phone_number,
    subscription_plan,
    subscription_status,
    DATEDIFF(subscription_end_date, NOW()) as days_remaining
FROM user_sessions
WHERE subscription_status = 'active';
```

### Ver historial completo de solicitudes
```sql
SELECT
    pr.id,
    pr.phone_number,
    pr.plan_name,
    pr.status,
    pr.requested_at,
    pr.reviewed_by
FROM plan_requests pr
ORDER BY pr.requested_at DESC;
```

---

## ⚠️ Notas Importantes

1. **Super Admin**: Solo el número `595994854167` puede aprobar/rechazar solicitudes
2. **Tabla correcta**: Los planes están en la tabla `plans`, NO en `subscription_plans`
3. **user_sessions**: Es la tabla principal para usuarios que se conectan con QR
4. **Redirección**: Debes implementar la lógica para redirigir usuarios sin plan a la vista de `<PlanSelector />`

---

## 🧪 Prueba del Sistema

### 1. Crear una solicitud (como cliente)

```bash
curl -X POST http://localhost:3001/api/plan-requests \
  -H "Content-Type: application/json" \
  -d '{"phone": "595985768793", "planId": 1}'
```

### 2. Ver solicitudes (como admin)

```bash
curl http://localhost:3001/api/plan-requests?status=pending \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 3. Aprobar solicitud (como admin)

```bash
curl -X PUT http://localhost:3001/api/plan-requests/1/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"adminPhone": "595994854167"}'
```

---

## ✨ Próximos Pasos Sugeridos

1. **Middleware de redirección**: Crear middleware que redirija usuarios sin plan a la vista de planes
2. **Carga de comprobantes**: Agregar endpoint para subir comprobantes de pago
3. **Notificaciones**: Enviar WhatsApp al admin cuando hay nueva solicitud
4. **Expiración automática**: Cronjob que marque planes como expirados automáticamente

---

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs del servidor: `pm2 logs whatsflow-server`
2. Revisa la consola del navegador para errores frontend
3. Verifica que el SQL se ejecutó correctamente

---

**Autor**: Sistema generado con Claude Code
**Fecha**: Diciembre 2024
**Versión**: 1.0.0
