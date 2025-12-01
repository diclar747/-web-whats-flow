# 🔧 ARREGLAR SESIONES - PLAN DETALLADO

## PROBLEMA RAÍZ

El sistema trata TODAS las sesiones de forma GLOBAL, sin diferenciar entre:
- Session A (595985768793)
- Session B (595984219248)  
- Session del Super Admin (595994854167)

Cuando un usuario inicia sesión, el sistema **cierra sesiones de otros usuarios** erroneamente.

## SOLUCIÓN

### 1. Cambiar modelo mental: SESIONES INDEPENDIENTES POR WHATSAPP NUMBER

```
WhatsApp 595985768793
├─ Admin: 595985768793@whatsapp.local
├─ Agentes: claudio@cnid.com.py, otro@email.com
└─ Session ID: b62650fb11e55d05

WhatsApp 595984219248
├─ Admin: 595984219248@whatsapp.local
├─ Agentes: agente2@email.com
└─ Session ID: 77760cb800239304

WhatsApp 595994854167
├─ Super Admin: 595994854167@whatsapp.local
└─ Session ID: 9ee5bdd2f1f07dda
```

### 2. Cambios en /src/server/index.js

#### LÍNEA: Buscar dónde se crea WhatsApp session (hacer.sock.bind)

**AGREGAR:**
```javascript
// Crear sesión con nombre DESCRIPTIVO basado en teléfono
const sessionName = `whatsapp-${phoneNumber.replace(/@.*$/, '')}`;
```

#### LÍNEA: En getUserPhoneNumber() y getOrCreateUserSession()

Asegurar que SIEMPRE retorna el teléfono del ADMIN asociado a esa sesión, NO del super admin.

#### LÍNEA: En login endpoint (/api/auth/login)

**CAMBIAR LA LÓGICA:**
```
SI user.role === 'agent' OR user.role === 'supervisor'
  ├─ Obtener admin_phone del agente
  ├─ Buscar admin con ese phone
  ├─ Obtener session_id del admin
  ├─ ASIGNAR users.session_id = session_id_del_admin
  └─ ✅ Agente reutiliza Socket del admin
ELSE SI user.role === 'admin'
  ├─ Buscar o crear session_id para este admin
  ├─ ASIGNAR users.session_id = su_session_id_único
  ├─ Preparar para escanear QR de WhatsApp
  └─ ✅ Admin abre nuevo Socket
```

### 3. ELIMINAR lógica de cierre de sesiones

**BUSCAR Y ELIMINAR/COMENTAR:**
- Cualquier código que cierre sesiones cuando otro usuario inicia
- Cualquier verificación de "solo una sesión por usuario"
- Cualquier emit de "session-invalidated" global

**MANTENER SOLO:**
- Cierre de sesión cuando el MISMO usuario (mismo email) inicia desde otro navegador en el MISMO dispositivo
- Logout genuino cuando usuario hace click en "Cerrar sesión"

### 4. Cambios en /src/client/src

#### SocketContext.tsx

**NO escuchar `session-invalidated` global**
- Solo debería cerrar si es realmente LA MISMA SESIÓN

#### App.tsx

**NO cerrar sesión por evento global de "otro dispositivo"**
- Diferentes números = diferentes sesiones = NO interferir

### 5. FLUJOS A VERIFICAR

**FLUJO 1: Dos admins diferentes**
```
Navegador A: Login 595985768793
  ↓
Navegador B: Login 595984219248  
  ↓
✅ Ambos funcionan juntos
✅ No se interfieren
✅ Cada uno con su WhatsApp
```

**FLUJO 2: Admin + Agente del mismo admin**
```
Navegador A: Login 595985768793 (admin)
  ↓ Admin conecta WhatsApp
Navegador B: Login claudio@cnid.com.py (agente)
  ↓
✅ Agente obtiene session_id del admin
✅ Reutiliza Socket de 595985768793
✅ Ambos pueden enviar mensajes
```

**FLUJO 3: Mismo usuario, dos navegadores**
```
Navegador A: Login claudio@cnid.com.py (device A)
  ↓
Navegador B: Login claudio@cnid.com.py (device B)
  ↓
⚠️ Opcional: Cerrar sesión de device A (la más antigua)
```

## ARCHIVOS A MODIFICAR

1. `/src/server/index.js` - Línea 13571-13656 (Login logic)
2. `/src/server/index.js` - Buscar y remover emit de session-invalidated
3. `/src/client/src/context/SocketContext.tsx` - Remover listener de session-invalidated
4. `/src/client/src/App.tsx` - Remover listener de session-closed

## VERIFICACIÓN FINAL

```
SELECT * FROM users WHERE id IN (2, 11, 13);
SELECT * FROM user_sessions;
```

Debe mostrar:
- ID 2 (admin 595985768793): session_id = b62650fb11e55d05
- ID 11 (agente Claudio): session_id = b62650fb11e55d05 (MISMO del admin)
- ID 13 (admin 595984219248): session_id = 77760cb800239304 (DIFERENTE)
- Todas las sesiones con is_active = 1

## RESULTADO ESPERADO

✅ Dos navegadores con diferentes usuarios = ambos funcionan
✅ Agente usa WhatsApp del admin = mensajes correctos
✅ No hay interferencias entre sesiones
✅ Sistema escalable a múltiples admins y agentes
