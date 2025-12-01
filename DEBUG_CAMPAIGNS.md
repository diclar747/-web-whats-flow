# 🔍 INSTRUCCIONES PARA DEBUGGEAR CAMPAÑA NO GUARDADA

## El Problema
- Crear campaña "qweqwe" muestra "Campaña creada exitosamente" ✅
- Pero NO aparece en la lista de campañas ❌
- No hay logs `[UI-CAMPAIGNS-DEBUG]` en la consola ❌

## Solución: 3 PASOS

### PASO 1: Limpiar Cache y Service Worker
1. Abre esta URL en el navegador: **http://web.whats-flow.com/clear-cache.html**
2. Haz clic en el botón rojo **"Limpiar TODO"**
3. Espera a que aparezca el mensaje verde ✅
4. **Cierra el navegador COMPLETAMENTE** (no solo la pestaña)
5. Abre nuevamente WhatsFlow: **http://web.whats-flow.com**

### PASO 2: Crear Campaña y Capturar Logs
1. Abre **F12** (DevTools) en el navegador
2. Ve a la pestaña **Console**
3. Crea una **nueva campaña** desde "Crear Nueva Campaña"
   - Nombre: `TEST CAMPAIGN`
   - Mensaje: `Test message`
   - Contactos: Selecciona al menos 1 contacto
   - Haz clic en **"Crear"**

4. **Copia TODO lo que aparezca en la consola** que contenga:
   - `[UI-CAMPAIGNS-DEBUG]`
   - `[API-POST-DEBUG]`
   - Cualquier `error` o `ERROR`

### PASO 3: Verifica el Servidor
Abre una terminal y ejecuta:
```bash
pm2 logs whatsflow-backend --lines 50 --nostream | grep -E "\[CAMPAIGNS\]|\[API-POST\]"
```

Esto mostrará los logs del servidor cuando hagas la petición.

## ¿Qué Debería Ver?

### En la Consola del Navegador (F12):
```
[UI-CAMPAIGNS-DEBUG] 📤 Iniciando envío de campaña al backend
[UI-CAMPAIGNS-DEBUG] sessionId: 595985768793
[UI-CAMPAIGNS-DEBUG] campaignData: {...}
[UI-CAMPAIGNS-DEBUG] contactSelectionType: segments
[UI-CAMPAIGNS-DEBUG] recipients.length: 2
[UI-CAMPAIGNS-DEBUG] URL: http://localhost:3002/api/personalized-campaigns/create
[UI-CAMPAIGNS-DEBUG] Request body: {...}
[UI-CAMPAIGNS-DEBUG] Response status: 200
[UI-CAMPAIGNS-DEBUG] Response data: {success: true, campaign: {...}}
```

### En los Logs del Servidor:
```
[API-POST-DEBUG] 📡 POST /api/personalized-campaigns/create
[CAMPAIGNS] 📝 Solicitud de crear campaña recibida
[CAMPAIGNS] ✅ INSERT ejecutado correctamente
```

## Si Ves Error

**Si ves error `403`, `404`, `500`** → copiar el error exacto

**Si NO ves logs `[UI-CAMPAIGNS-DEBUG]` en la consola** → Service worker sigue en cache, repetir PASO 1

**Si ves los logs pero dice `error` en la respuesta** → problema en el backend

---

**ENVÍA:**
1. Screenshot de los logs de la consola
2. Output de `pm2 logs` que muestre la petición
3. Si creas la campaña y se guarda ✅ o no se guarda ❌

¡Así podré saber exactamente dónde está el problema!
