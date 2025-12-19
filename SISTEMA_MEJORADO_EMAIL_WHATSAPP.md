# 🚀 Sistema Mejorado: Email + WhatsApp (Diciembre 2025)

## 📋 Resumen de Cambios

El sistema ahora sigue este flujo:

```
1. REGISTRO / LOGIN CON EMAIL
   ↓
2. DASHBOARD DEL USUARIO
   ↓
3. CONFIGURACIÓN → Pestaña WhatsApp
   ↓
4. PRESIONAR "CONECTAR POR QR"
   ↓
5. ESCANEAR QR CON TELÉFONO
   ↓
6. SESIÓN GUARDADA (SIN RECARGAS)
   ↓
7. USO DEL SISTEMA (Campañas, Chats, Agentes, etc.)
```

---

## 🔧 Mejoras Implementadas

### ✅ Servidor (Backend)

#### 1. **POST /api/qr-refresh** - Mejoras
- ✓ Removidas limpiezas innecesarias que causaban recargas
- ✓ Timeout mejorado de 20s (antes 10s)
- ✓ Mejor logging para debugging
- ✓ Respuesta incluye `expiresIn: 120` segundos

#### 2. **POST /api/auth/link-whatsapp-session** - Mejoras
- ✓ Actualiza `is_active = 1` y `last_activity`
- ✓ Retorna explícitamente `shouldReload: false`
- ✓ Mejor manejo de errores
- ✓ Validación mejorada de usuario

#### 3. **GET /api/session/:sessionId/status** - Sin cambios necesarios
- Ya valida correctamente sesiones en memoria
- Ya detecta cuando se escanea QR
- Ya retorna `source: 'memory'` cuando está conectada

### ✅ Cliente (Frontend)

#### 1. **SettingsModule.tsx - pollSessionStatus()**
- ✓ No recarga la página
- ✓ Limpia UI después de vincular
- ✓ Espera 1s antes de recargar lista de sesiones
- ✓ Mejor manejo de errores sin perder sesión

#### 2. **SettingsModule.tsx - startQrFlow()**
- ✓ Genera QR limpiamente
- ✓ Inicia polling automático
- ✓ Mejor logging para debugging
- ✓ Manejo mejorado de excepciones

---

## 🧪 Cómo Probar

### **Prerrequisitos**
- Sistema funcionando en `https://web.whats-flow.com` (o `http://localhost:3000`)
- Base de datos sincronizada
- Servidor Node.js corriendo

### **Paso 1: Registrarse o Login**

```bash
# Opción A: Nuevo usuario
1. Ir a https://web.whats-flow.com/register
2. Ingresar:
   - Nombre completo
   - Email (ej: usuario@test.com)
   - Teléfono
   - Contraseña (mín. 6 caracteres)
3. Presionar "Registrarse"
4. Redirige a login automáticamente

# Opción B: Usuario existente
1. Ir a https://web.whats-flow.com/login
2. Ingresar email y contraseña
```

### **Paso 2: Conectar WhatsApp**

```bash
1. Después de login, presionar botón menú (≡)
2. Ir a "Configuración" o "Settings"
3. Presionar pestaña "WhatsApp" (Tab 3)
4. Presionar botón "Conectar por QR" (color verde)
5. ESPERAR: Verás mensaje "Regenerando QR..."
6. Se mostrará código QR después de 1-2 segundos
```

### **Paso 3: Escanear QR**

```bash
# EN TELÉFONO CON WHATSAPP
1. Abrir WhatsApp
2. Ir a Ajustes (⚙️) 
3. Dispositivos vinculados / Linked devices
4. Presionar "Vincular un dispositivo" / "Link a device"
5. ESCANEAR el código QR que ves en pantalla
6. Confirmar con el número de WhatsApp
```

### **Paso 4: Verificar Conexión**

```bash
✓ El QR desaparecerá
✓ Aparecerá mensaje de éxito: "✅ WhatsApp conectado: +595..."
✓ En la sección "Líneas conectadas" verás tu número
✓ La sesión se mostrará como "✓ Conectada"
✓ NO habrá recarga de página
```

### **Paso 5: Usar el Sistema**

Ahora puedes:
- 📱 Ver y responder chats
- 🎯 Crear campañas
- 🤖 Usar agentes
- 📊 Ver reportes
- ⚙️ Configurar automatizaciones

---

## 🐛 Troubleshooting

### "El QR no aparece después de presionar botón"

**Problema:** El servidor tarda en generar QR
**Solución:**
1. Verificar logs del servidor: `tail -f server.log | grep QR`
2. Si ves `[QR-REFRESH] ❌ Timeout`, aumentar timeout en servidor
3. Verificar conexión a internet en servidor

### "Se recarga la página cuando escaneo QR"

**Problema:** Error en endpoint de link-whatsapp-session
**Solución:**
1. Abrir DevTools (F12)
2. Ir a pestaña "Network"
3. Escanear QR nuevamente
4. Ver request a `/api/auth/link-whatsapp-session`
5. Si retorna error 500, verificar logs: `tail -f server.log | grep AUTH`

### "Dice que WhatsApp está conectado pero no funciona"

**Problema:** Sesión en DB pero socket muerto
**Solución:**
1. Ir a Configuración → WhatsApp
2. Encontrar tu línea en "Líneas conectadas"
3. Presionar botón "🔄 Reconectar"
4. O presionar "Eliminar" y "Conectar por QR" nuevamente

### "Error: 'Límite de líneas alcanzado'"

**Problema:** Ya hay máximo de líneas conectadas
**Solución:**
1. Ir a Configuración → WhatsApp
2. En "Líneas conectadas", presionar "🗑️ Eliminar" en una línea vieja
3. Esperar confirmación
4. Presionar "Conectar por QR" nuevamente

---

## 🔍 Logs Importantes

Ver logs en tiempo real:

```bash
# Terminal SSH
cd /var/www/web.whats-flow.com

# Ver últimas líneas
tail -100 server.log

# Ver en tiempo real
tail -f server.log

# Filtrar QR
grep -i "QR" server.log | tail -50

# Filtrar WhatsApp
grep -i "WHATSAPP\|AUTH" server.log | tail -50

# Ver errores recientes
grep -i "ERROR\|❌" server.log | tail -20
```

**Log esperado cuando conectas exitosamente:**

```
[QR-REFRESH] 🔄 Regenerando QR para dispositivo: device_123...
[QR-REFRESH] 🆕 Session ID: abc123def456
[QR-REFRESH] 🚀 Iniciando sesión...
[QR-REFRESH] ✨ QR generado en 2.5s
[QR-REFRESH] ✅ QR convertido a DataURL
[SESSION-STATUS] ✅ Nueva sesión encontrada en memoria: abc123def456
[AUTH] 🔗 Vinculando WhatsApp: whatsappSessionId: abc123def456
[AUTH] ✅ WhatsApp vinculado para usuario 5
```

---

## 📊 Estados del Sistema

### Estado del Usuario

Después de login con email:
- **Tabla:** `user_sessions`
- **Campo clave:** `session_id`
- **Valor:** Email/contraseña → Session ID vacío → Session ID de WhatsApp

### Estados de Sesión WhatsApp

1. **SIN CONECTAR:**
   - `sessions` map: vacío
   - DB: `is_active = 0`
   - UI: "❌ No conectado"

2. **CONECTANDO:**
   - `sessions` map: socket creándose
   - DB: no tiene registro aún
   - UI: "Escaneando QR..."

3. **CONECTADO:**
   - `sessions` map: socket activo
   - DB: `is_active = 1`, `phone_number` lleno
   - UI: "✅ Conectado: +595..."

4. **DESCONECTADO (pero guardado):**
   - `sessions` map: vacío
   - DB: `is_active = 1` pero socket muerto
   - UI: "⚠️ Desconectado (puedes reconectar)"

---

## 🔐 Seguridad

- ✓ JWT token en header Authorization
- ✓ Email/contraseña hasheados con bcrypt
- ✓ Session ID único por usuario
- ✓ Validación de permisos en cada endpoint
- ✓ Rate limiting en `/api/qr-refresh` (40min entre regeneraciones)

---

## 📈 Próximos Pasos (Opcional)

Si quieres más mejoras:

1. **Push notifications** cuando llegan mensajes
2. **WhatsApp Web en iframe** integrado
3. **Respuestas automáticas** por hora
4. **Integración con CRM** externo
5. **Analytics** de mensajes por sesión

---

## 📞 Soporte

Si algo no funciona:

1. **Verificar logs:** `tail -f server.log`
2. **Reiniciar servidor:** `npm restart` (si usas PM2)
3. **Limpiar caché del navegador:** Ctrl+Shift+Supr
4. **Verificar BD:** `SELECT * FROM user_sessions WHERE email = 'tu-email';`

---

**Última actualización:** 18 de Diciembre de 2025
**Versión del sistema:** 2.1.0 (Email + WhatsApp Mejorado)
