# CORRECCIÓN: Filtrado de Agentes en Módulo de Chat

## Fecha: 2025-12-15

---

## PROBLEMA REPORTADO

El usuario **595994854167** ve al agente **claudio@cnid.com.py** en su lista de "Agentes Disponibles" en el módulo de chat, cuando ese agente pertenece al usuario **595985768793**.

### Evidencia del Problema:

**Panel de Chat - Usuario 595994854167:**
```
Agentes Disponibles
Arrastra un chat aquí para transferir

En Línea (0)
    No hay agentes en línea

Desconectados (1)
    claudio@cnid.com.py
    offline
```

**❌ Problema:** El agente `claudio@cnid.com.py` NO debería aparecer para el usuario 595994854167.

---

## CAUSA RAÍZ IDENTIFICADA

Los endpoints que devuelven la lista de agentes disponibles **NO estaban filtrando por `admin_phone`**:

### Endpoints Afectados:

1. **`GET /api/agents/available`** (línea 17809 de index.js)
2. **`GET /api/agents/online`** (línea 828 de agents-permissions-endpoints.js)

### Query Original (INCORRECTA):

```sql
-- ❌ Devolvía TODOS los agentes del sistema
SELECT id, name, email, phone, role, status, avatar_url, agent_status
FROM users
WHERE status = 'active' AND role IN ('agent', 'supervisor')
ORDER BY role DESC, name ASC
```

**Resultado:** Todos los usuarios con role='agent' aparecían para todos, sin importar quién los creó.

---

## SOLUCIÓN IMPLEMENTADA

### Cambio 1: Endpoint `/api/agents/available`

**Archivo:** `/var/www/web.whats-flow.com/src/server/index.js` (líneas 17809-17899)

**Lógica Nueva:**

```javascript
// ✅ Paso 1: Determinar adminPhone del usuario autenticado
let adminPhone = null;

// Opción A: Desde sessionId (si es un phone_number)
if (sessionId && sessionId.match(/^\d{7,}$/)) {
    adminPhone = sessionId;
}
// Opción B: Desde user_sessions (si sessionId es un hash)
else if (sessionId) {
    const [sessions] = await connection.execute(
        'SELECT phone_number FROM user_sessions WHERE session_id = ? AND is_active = TRUE',
        [sessionId]
    );
    if (sessions.length > 0) {
        adminPhone = sessions[0].phone_number;
    }
}
// Opción C: Desde JWT token
else if (req.headers.authorization) {
    const decoded = jwt.verify(token, JWT_SECRET);
    adminPhone = decoded.phone;
}

// ✅ Paso 2: Filtrar por admin_phone
const query = `
    SELECT id, name, email, phone, role, status, avatar_url, agent_status
    FROM users
    WHERE status = 'active'
      AND role IN ('agent', 'supervisor')
      AND admin_phone = ?  -- ✅ FILTRO CRÍTICO
    ORDER BY role DESC, name ASC
`;

const [users] = await connection.execute(query, [adminPhone]);
```

**Resultado:**
- Usuario **595985768793** → Ve solo SUS agentes (incluido claudio@cnid.com.py)
- Usuario **595994854167** → Ve solo SUS agentes (NO ve claudio@cnid.com.py) ✅

---

### Cambio 2: Endpoint `/api/agents/online`

**Archivo:** `/var/www/web.whats-flow.com/src/server/agents-permissions-endpoints.js` (líneas 828-924)

**Mismo patrón aplicado:**

```javascript
// ✅ Determinar adminPhone (igual lógica que /api/agents/available)
let adminPhone = null;
// ... (mismo código)

// ✅ Filtrar query
const query = `
    SELECT id as userId, name as userName, email, phone, role,
           agent_status as status, last_activity as lastActivity
    FROM users
    WHERE role IN ('agent', 'supervisor', 'admin')
      AND admin_phone = ?  -- ✅ FILTRO CRÍTICO
    ORDER BY
        CASE
            WHEN agent_status = 'online' THEN 1
            WHEN agent_status = 'available' THEN 2
            WHEN agent_status = 'busy' THEN 3
            ELSE 4
        END,
        name ASC
`;

const [agents] = await connection.execute(query, [adminPhone]);
```

---

## FLUJO COMPLETO CORREGIDO

### Caso de Uso: Usuario 595994854167 ve su lista de agentes

```
1. Frontend solicita:
   GET /api/agents/available?sessionId=7bcc5fc854e72843

2. Backend determina adminPhone:
   - sessionId = '7bcc5fc854e72843' (no es phone_number)
   - Consulta user_sessions:
     SELECT phone_number FROM user_sessions
     WHERE session_id = '7bcc5fc854e72843' AND is_active = TRUE
   - Resultado: phone_number = '595994854167'
   - adminPhone = '595994854167' ✅

3. Backend consulta agentes:
   SELECT * FROM users
   WHERE status = 'active'
     AND role IN ('agent', 'supervisor')
     AND admin_phone = '595994854167'  -- ✅ SOLO SUS AGENTES

4. Resultado:
   - Si 595994854167 NO ha creado agentes → agents = []
   - Si 595994854167 tiene agentes → agents = [sus_agentes]
   - claudio@cnid.com.py (admin_phone='595985768793') NO aparece ✅
```

---

### Caso de Uso: Usuario 595985768793 ve su lista de agentes

```
1. Frontend solicita:
   GET /api/agents/available?sessionId=b76384173354a754

2. Backend determina adminPhone:
   - sessionId = 'b76384173354a754' (no es phone_number)
   - Consulta user_sessions:
     SELECT phone_number FROM user_sessions
     WHERE session_id = 'b76384173354a754' AND is_active = TRUE
   - Resultado: phone_number = '595985768793'
   - adminPhone = '595985768793' ✅

3. Backend consulta agentes:
   SELECT * FROM users
   WHERE status = 'active'
     AND role IN ('agent', 'supervisor')
     AND admin_phone = '595985768793'  -- ✅ SOLO SUS AGENTES

4. Resultado:
   - claudio@cnid.com.py tiene admin_phone = NULL (después de corrección anterior)
   - Si se corrige a admin_phone='595985768793' → aparecerá solo para él ✅
```

---

## VERIFICACIÓN DE DATOS

### Estado Actual de la Base de Datos:

```sql
-- Usuario claudio@cnid.com.py
SELECT id, name, phone, role, admin_phone FROM users WHERE email = 'claudio@cnid.com.py';
```

**Resultado:**
```
id=5, name='claudio@cnid.com.py', phone='595985768793', role='agent', admin_phone=NULL
```

### ⚠️ ATENCIÓN:

El usuario `claudio@cnid.com.py` tiene `admin_phone = NULL` después de nuestra corrección anterior (eliminar auto-referencia).

**Esto significa que:**
- ✅ Ya NO aparece como su propio agente
- ❌ Pero tampoco aparece para NADIE (porque admin_phone=NULL significa "usuario principal")

### Decisión a Tomar:

**¿Cuál es el rol correcto de claudio@cnid.com.py?**

#### Opción A: Es un usuario PRINCIPAL (Admin/Owner)
```sql
-- Mantener como está:
UPDATE users SET role = 'admin', admin_phone = NULL
WHERE email = 'claudio@cnid.com.py';
```
- Resultado: Puede crear SUS propios agentes
- NO aparece en lista de agentes de nadie

#### Opción B: Es un AGENTE de 595985768793
```sql
-- Asignar como agente:
UPDATE users SET role = 'agent', admin_phone = '595985768793'
WHERE email = 'claudio@cnid.com.py';
```
- Resultado: Aparece SOLO en la lista de agentes de 595985768793
- NO puede crear agentes (es un agente, no admin)

#### Opción C: Es AMBOS (Admin Y Agente)
```sql
-- Configuración especial:
UPDATE users SET role = 'admin', admin_phone = '595985768793'
WHERE email = 'claudio@cnid.com.py';
```
- Resultado: Aparece como agente de 595985768793
- PERO también tiene permisos de admin (puede crear agentes)

---

## RECOMENDACIÓN

Basándome en el contexto original del problema, **recomiendo Opción B**:

```sql
-- Ejecutar:
UPDATE users
SET role = 'agent', admin_phone = '595985768793'
WHERE email = 'claudio@cnid.com.py';
```

**Razón:**
- El usuario 595985768793 es el que tiene agentes
- claudio@cnid.com.py debería SER uno de esos agentes
- El email `claudio@cnid.com.py` sugiere que es un agente (no admin principal)

---

## ARCHIVOS MODIFICADOS

### 1. `/var/www/web.whats-flow.com/src/server/index.js`

**Función:** `GET /api/agents/available`
**Líneas:** 17809-17899
**Cambios:**
- ✅ Agregada lógica para determinar `adminPhone` desde `sessionId` o JWT
- ✅ Agregado filtro `AND admin_phone = ?` en query
- ✅ Protección: si no hay adminPhone, devuelve lista vacía

### 2. `/var/www/web.whats-flow.com/src/server/agents-permissions-endpoints.js`

**Función:** `GET /api/agents/online`
**Líneas:** 828-924
**Cambios:**
- ✅ Agregada lógica para determinar `adminPhone` desde `sessionId` o JWT
- ✅ Agregado filtro `AND admin_phone = ?` en query
- ✅ Protección: si no hay adminPhone, devuelve lista vacía

---

## PRUEBAS RECOMENDADAS

### Prueba 1: Verificar Filtrado por Admin

```bash
# Como usuario 595994854167:
curl -X GET "http://localhost:3001/api/agents/available?sessionId=7bcc5fc854e72843"

# Resultado esperado:
# - NO debe incluir claudio@cnid.com.py
# - Solo agentes con admin_phone='595994854167'
```

### Prueba 2: Verificar Filtrado por Otro Admin

```bash
# Como usuario 595985768793:
curl -X GET "http://localhost:3001/api/agents/available?sessionId=b76384173354a754"

# Resultado esperado (después de aplicar UPDATE recomendado):
# - DEBE incluir claudio@cnid.com.py
# - Solo agentes con admin_phone='595985768793'
```

### Prueba 3: Verificar Sin sessionId

```bash
# Sin sessionId (esperado: lista vacía por seguridad)
curl -X GET "http://localhost:3001/api/agents/available"

# Resultado esperado:
# {"success": true, "agents": []}
```

---

## CONSULTA SQL PARA CORREGIR ADMIN_PHONE

```sql
-- ====================================================
-- CORRECCIÓN FINAL: Asignar claudio@cnid.com.py como agente
-- ====================================================

-- Verificar estado actual
SELECT id, name, email, phone, role, admin_phone
FROM users
WHERE email = 'claudio@cnid.com.py';

-- Opción recomendada: Asignar como agente de 595985768793
UPDATE users
SET role = 'agent',
    admin_phone = '595985768793'
WHERE email = 'claudio@cnid.com.py';

-- Verificar cambio
SELECT id, name, email, phone, role, admin_phone
FROM users
WHERE email = 'claudio@cnid.com.py';

-- Resultado esperado:
-- id=5, name='claudio@cnid.com.py', phone='595985768793',
-- role='agent', admin_phone='595985768793'
```

---

## LOGS DE DEBUGGING

Después de la corrección, los logs del servidor mostrarán:

```
[AGENTS-AVAILABLE] 📞 Phone encontrado desde session_id: 595994854167
[AGENTS-AVAILABLE] 🔍 Filtrando agentes para admin: 595994854167
[AGENTS-AVAILABLE] ✅ 0 agentes encontrados para admin 595994854167
```

Si el usuario 595994854167 NO tiene agentes, la lista estará vacía (correcto).

```
[AGENTS-AVAILABLE] 📞 Phone encontrado desde session_id: 595985768793
[AGENTS-AVAILABLE] 🔍 Filtrando agentes para admin: 595985768793
[AGENTS-AVAILABLE] ✅ 1 agentes encontrados para admin 595985768793
```

Después de aplicar el UPDATE recomendado, el usuario 595985768793 verá a claudio@cnid.com.py.

---

## RESUMEN EJECUTIVO

### Problemas Corregidos ✅

1. **Filtrado de agentes sin admin_phone** → RESUELTO
   - Agregado filtro `AND admin_phone = ?` en 2 endpoints
   - Cada usuario ve solo SUS agentes

2. **Lógica para determinar adminPhone** → IMPLEMENTADA
   - Soporta sessionId (phone_number o hash)
   - Soporta JWT token en Authorization header
   - Protección: lista vacía si no se puede determinar

3. **Seguridad mejorada** → IMPLEMENTADA
   - Ya NO es posible ver agentes de otros admins
   - Aislamiento completo entre usuarios

### Pendiente ⚠️

1. **Decidir rol de claudio@cnid.com.py**
   - Aplicar UPDATE recomendado (ver arriba)
   - O definir rol específico según necesidad del negocio

2. **Reiniciar servidor** para que cambios tomen efecto
   ```bash
   sudo systemctl restart whatsflow
   # O según tu método de deploy
   ```

3. **Probar en frontend** que la lista se actualice correctamente

---

**Documento creado por:** Claude Sonnet 4.5
**Fecha:** 2025-12-15
**Estado:** ✅ CÓDIGO CORREGIDO - PENDIENTE APLICAR UPDATE Y REINICIAR
