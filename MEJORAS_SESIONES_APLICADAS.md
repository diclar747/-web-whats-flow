# MEJORAS AL SISTEMA DE SESIONES - APLICADAS
**Fecha:** 22 de Diciembre 2025

## PROBLEMAS IDENTIFICADOS Y SOLUCIONADOS

### 1. ✅ Campo `session=0` no forzaba logout en el sistema
**Problema:** Cuando el campo `session` en la tabla `users` se establecía en 0, el sistema no cerraba la sesión automáticamente y no redirigía al usuario.

**Solución Aplicada:**
- **Archivo:** `src/server/auth-endpoints.js` (líneas 229-280)
- **Cambio:** 
  - Modificado el endpoint `GET /api/auth/verify` para incluir el campo `session` en la consulta SQL
  - Agregada validación: si `session = 0`, el endpoint retorna error 401 con flags `requiresReauth: true` y `sessionClosed: true`
  - El frontend detecta estos flags y redirige a `https://web.whats-flow.com/`

```javascript
// Verificar campo session
if (user.session === 0 || user.session === '0') {
    console.log(`[AUTH-VERIFY] ❌ Sesión cerrada para usuario ${user.email} (session=0)`);
    return res.status(401).json({
        success: false,
        error: 'Sesión cerrada. Por favor, inicia sesión nuevamente.',
        requiresReauth: true,
        sessionClosed: true
    });
}
```

### 2. ✅ Logout actualiza correctamente `session=0`
**Estado:** Ya estaba implementado correctamente en el código existente.

**Ubicación:** `src/server/auth-endpoints.js` (líneas 283-319)
- El endpoint `POST /api/auth/logout` actualiza `users.session = 0` correctamente
- También actualiza `user_sessions.is_active = 0`

### 3. ✅ Frontend redirige cuando `session=0`
**Problema:** El frontend no detectaba cuando el backend indicaba que la sesión había sido cerrada.

**Solución Aplicada:**
- **Archivo:** `src/client/src/App.tsx` (líneas 710-748)
- **Cambio:** Modificada la función `verifyToken` para detectar `requiresReauth` y `sessionClosed`
- Cuando se detecta sesión cerrada:
  1. Se ejecuta `handleLogout()` para limpiar el estado local
  2. Se redirige a `https://web.whats-flow.com/`

```javascript
} else if (data.requiresReauth || data.sessionClosed) {
    // Sesión cerrada (session=0) o token inválido - redirigir a login
    console.log('❌ Sesión cerrada o token inválido, redirigiendo...');
    handleLogout();
    window.location.href = 'https://web.whats-flow.com/';
}
```

### 4. ✅ Super Admin carga datos incorrectos (claudio@cnid.com.py)
**Problema:** Cuando el super admin iniciaba sesión, el sistema cargaba datos de otro usuario (claudio@cnid.com.py) en lugar de sus propios datos.

**Causa:** El endpoint `/api/session/:sessionId/status` estaba mapeando incorrectamente los emails a números de teléfono usando una query que podía devolver cualquier usuario:
```sql
SELECT phone FROM users WHERE email = ? OR admin_phone = ? LIMIT 1
```

**Solución Aplicada:**
- **Archivo:** `src/server/index.js` (líneas 9217-9234)
- **Cambio:** 
  - Modificado el mapeo de email a sessionId para usar `user.id` en lugar de `phone`
  - Esto es consistente con el login que asigna `sessionId = user.id`
  - Agregados logs específicos para rastrear el mapeo

```javascript
// 🔄 Si recibimos un email, mapear a user.id (sessionId correcto)
if (sessionId && sessionId.includes('@') && pool) {
    try {
        const connection = await pool.getConnection();
        // ✅ Mapear email a user.id, que es el sessionId real según el login
        const [userRows] = await connection.execute(
            'SELECT id, email FROM users WHERE email = ? LIMIT 1',
            [sessionId]
        );
        connection.release();
        
        if (userRows.length > 0) {
            const mappedSessionId = String(userRows[0].id);
            console.log(`[SESSION-STATUS] 📧 Email ${sessionId} (${userRows[0].email}) mapeado a sessionId: ${mappedSessionId}`);
            sessionId = mappedSessionId;
        }
    } catch (err) {
        console.warn(`[SESSION-STATUS] Error mapeando email a sessionId:`, err.message);
    }
}
```

## FLUJO COMPLETO DEL SISTEMA DE SESIONES

### Login:
1. Usuario ingresa email y password
2. Backend valida credenciales
3. Backend actualiza `users.session = 1` y `users.last_login = NOW()`
4. Backend crea/actualiza `user_sessions` con `session_id = user.id`, `is_active = 1`
5. Backend genera JWT token
6. Backend retorna: `{ token, sessionId: user.id, user: {...} }`
7. Frontend guarda token y sessionId en sessionStorage

### Verificación de Sesión:
1. Frontend envía token en header `Authorization: Bearer {token}`
2. Backend verifica JWT con `authenticateJWT` middleware
3. Backend consulta `users` tabla incluyendo campo `session`
4. Si `session = 0` → retorna error 401 con `sessionClosed: true`
5. Si `session = 1` → retorna datos del usuario
6. Frontend detecta `sessionClosed` y redirige a `/`

### Logout:
1. Usuario hace clic en "Cerrar Sesión"
2. Frontend envía `POST /api/auth/logout` con token JWT
3. Backend actualiza `users.session = 0`
4. Backend actualiza `user_sessions.is_active = 0`
5. Frontend limpia sessionStorage y redirige a `/`

### Carga de Datos:
1. Frontend usa `sessionId = user.id` (número) para todas las peticiones
2. Endpoint `/api/session/:sessionId/status` mapea email a `user.id` si es necesario
3. Esto asegura que cada usuario cargue solo sus propios datos

## ARCHIVOS MODIFICADOS

1. **src/server/auth-endpoints.js**
   - Líneas 229-280: Verificación de `session=0` en `/api/auth/verify`
   
2. **src/client/src/App.tsx**
   - Líneas 710-748: Detección de sesión cerrada y redirección

3. **src/server/index.js**
   - Líneas 9217-9234: Mapeo correcto de email a sessionId

## TESTING

### Para probar el campo session=0:
```sql
-- Ver sesión actual de un usuario
SELECT id, email, session, last_login FROM users WHERE email = 'tu@email.com';

-- Cerrar sesión manualmente
UPDATE users SET session = 0 WHERE email = 'tu@email.com';

-- Verificar que el frontend redirige automáticamente
-- El usuario debería ser deslogueado y redirigido a https://web.whats-flow.com/
```

### Para probar logout:
1. Iniciar sesión normalmente
2. Hacer clic en "Cerrar Sesión"
3. Verificar en BD que `session = 0`:
```sql
SELECT id, email, session FROM users WHERE email = 'tu@email.com';
```

### Para probar super admin:
1. Iniciar sesión como super admin
2. Verificar que carga solo sus propios datos
3. Revisar logs del servidor: `pm2 logs whatsflow-server --lines 100`
4. Buscar línea: `[SESSION-STATUS] 📧 Email {email} mapeado a sessionId: {id}`
5. Verificar que el id sea correcto

## COMANDOS ÚTILES

```bash
# Reiniciar servidor para aplicar cambios
pm2 restart whatsflow-server

# Ver logs en tiempo real
pm2 logs whatsflow-server

# Verificar estado
pm2 status

# Compilar frontend
cd /var/www/web.whats-flow.com && npm run build

# Limpiar caché del navegador
# Usar Ctrl+Shift+R o Cmd+Shift+R
```

## NOTAS IMPORTANTES

1. **sessionId = user.id**: El sistema usa `user.id` como sessionId, no el teléfono ni el email
2. **session = 0**: Indica sesión cerrada, debe forzar logout
3. **session = 1**: Indica sesión activa
4. **Mapeo de email**: Solo ocurre cuando es absolutamente necesario, y ahora mapea correctamente a `user.id`
5. **Super Admin**: Debe ver solo sus propios datos, nunca datos de otros usuarios

## RESULTADO ESPERADO

✅ Cuando `session = 0` → Usuario es deslogueado automáticamente y redirigido a `/`
✅ Cuando se cierra sesión → Campo `session` se actualiza a 0 en la BD
✅ Super admin carga solo sus propios datos
✅ No hay más contaminación de datos entre usuarios
