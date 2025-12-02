# 🔄 INSTRUCCIONES PARA RECONECTAR WHATSAPP

## 📊 PROBLEMA IDENTIFICADO

Tu sesión de WhatsApp **595984219248** está DESCONECTADA (`is_active=0`).

**Por qué no funcionan los mensajes en tiempo real:**
- ❌ WhatsApp NO está conectado a los servidores
- ❌ NO hay sesión Baileys activa en memoria
- ❌ NO puede recibir eventos de mensajes nuevos
- ❌ Los mensajes que envías desde tu teléfono no llegan al sistema

---

## ✅ SOLUCIÓN: RECONECTAR MEDIANTE CÓDIGO QR

### **Paso 1: Hacer Logout del sistema**

1. Ve a: **https://web.whats-flow.com**
2. Haz clic en tu nombre de usuario (esquina superior derecha)
3. Selecciona **"Cerrar Sesión"** o **"Logout"**
4. El sistema te redirigirá a la página de login

### **Paso 2: Iniciar nueva sesión con QR**

1. En la página de login, verás opciones:
   - **Login con Email** (para agentes)
   - **Login con WhatsApp QR** (para administradores)

2. Selecciona **"Login con WhatsApp QR"**

3. El sistema generará un **código QR nuevo**

### **Paso 3: Escanear QR con tu teléfono**

1. Abre **WhatsApp** en tu teléfono **595984219248**

2. Ve a:
   - **Android**: Menú (3 puntos) → Dispositivos vinculados → Vincular un dispositivo
   - **iPhone**: Ajustes → Dispositivos vinculados → Vincular un dispositivo

3. **Escanea el código QR** que aparece en la pantalla

4. Espera la confirmación: **"✅ WhatsApp Conectado"**

### **Paso 4: Verificar conexión exitosa**

Deberías ver:
- ✅ Pantalla de dashboard cargada
- ✅ Lista de contactos sincronizada
- ✅ Chats recientes visibles
- ✅ Estado "Conectado" en la interfaz

---

## 🧪 PROBAR QUE FUNCIONA

### **Prueba 1: Mensaje desde tu teléfono**
1. Desde tu teléfono **595984219248**, envía un mensaje a **595985768793**
2. El mensaje debe aparecer **INMEDIATAMENTE** en la interfaz web
3. Debe mostrarse con tu nombre y avatar

### **Prueba 2: Mensaje desde la web**
1. Desde la interfaz web, envía un mensaje a **595985768793**
2. El mensaje debe aparecer en tu teléfono **595984219248**
3. Debe sincronizarse en ambos lados

### **Prueba 3: Recibir mensajes**
1. Pide a **595985768793** que te envíe un mensaje
2. Debe aparecer simultáneamente en:
   - Tu teléfono **595984219248**
   - La interfaz web

---

## 🔧 SI EL QR NO APARECE

### **Opción A: Forzar nueva sesión desde el navegador**

Abre la consola del navegador (F12) y ejecuta:

```javascript
// Limpiar localStorage
localStorage.clear();
sessionStorage.clear();

// Recargar página
location.reload();
```

### **Opción B: Crear sesión manualmente (API)**

Usa curl desde el servidor:

```bash
curl -X POST https://web.whats-flow.com/api/create-session \
  -H "Content-Type: application/json" \
  -d '{"syncHistory": true}'
```

Esto devolverá un `sessionId`. Luego accede a:
```
https://web.whats-flow.com/dashboard
```

---

## 📝 LOGS PARA VERIFICAR

Después de escanear el QR, verifica que en los logs aparezca:

```bash
pm2 logs whatsflow-backend --lines 50
```

Deberías ver:
```
✅ WhatsApp conectado: 595984219248
🔐 GENERAR TOKEN JWT PARA ADMIN (Login por QR)
📱 Usuario conectado: 595984219248
```

---

## ⚠️ IMPORTANTE

**NO intentes conectar múltiples veces seguidas:**
- Espera 60 segundos entre intentos
- El QR expira cada 60 segundos
- Si expira, haz clic en "Generar nuevo QR"

**Mantén la sesión estable:**
- No cierres WhatsApp en tu teléfono
- No desvincula dispositivos manualmente
- Mantén conexión a internet estable

---

## 🎯 RESULTADO ESPERADO

Después de reconectar correctamente:

1. ✅ **Base de datos actualizada:**
   ```sql
   phone_number='595984219248', is_active=1, connected_at=(fecha actual)
   ```

2. ✅ **Sesión en memoria activa:**
   - `sessions.get('595984219248')` devuelve objeto con `isConnected=true`

3. ✅ **Mensajes en tiempo real:**
   - Los logs muestran eventos `messages.upsert` cuando envías desde el teléfono
   - Los mensajes aparecen instantáneamente en la UI
   - from_me=true para mensajes enviados desde tu teléfono

4. ✅ **Sincronización bidireccional:**
   - Envío desde web → aparece en teléfono
   - Envío desde teléfono → aparece en web
   - Recepción → aparece en ambos lados

---

## 📞 SI SIGUES TENIENDO PROBLEMAS

Ejecuta desde el servidor:

```bash
# Ver estado actual de la sesión
mysql -u root -p'whatsflow2024' whatsflow -e "SELECT phone_number, is_active, connected_at FROM user_sessions WHERE phone_number='595984219248';"

# Ver logs en tiempo real
pm2 logs whatsflow-backend --lines 0

# Reiniciar backend si es necesario
pm2 restart whatsflow-backend
```

**Contacta al desarrollador con:**
- Captura de pantalla del error
- Logs de PM2
- Estado de la BD
- Hora exacta del problema

---

**Fecha de este documento:** 2 de diciembre de 2025  
**Estado del sistema:** Backend funcionando, frontend compilado, sesión DESCONECTADA
