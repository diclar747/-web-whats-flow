# 🧪 Guía de Prueba - Estados de WhatsApp

## Estado Actual

✅ **Implementación completada:**
- Componente `StatusList` con interfaz completa
- Endpoint del servidor `/api/whatsapp/statuses/:sessionId`
- Datos de ejemplo (mock) para los primeros 10 contactos
- Build exitoso

## ⚠️ Problema: "No hay estados disponibles"

### Diagnóstico

El mensaje "No hay estados disponibles" puede deberse a:

1. **No hay sesión activa de WhatsApp**
2. **No hay contactos sincronizados en la base de datos**
3. **El sessionId no es correcto**

### Cómo Probar

#### Paso 1: Verificar Sesión Activa

1. Abre el dashboard principal de WhatsFlow
2. Escanea el código QR para conectar WhatsApp
3. Espera a que aparezca "Conectado"

#### Paso 2: Sincronizar Contactos

1. En el dashboard, ve a "Contactos"
2. Haz clic en "Sincronizar"
3. Espera a que se descarguen los contactos

#### Paso 3: Probar la Pestaña de Estados

1. Ve al módulo de **Chat**
2. Haz clic en la pestaña **"Estados"**
3. Deberías ver dos sub-pestañas:
   - **Mis estados** (tus estados publicados)
   - **Recientes** (estados de contactos)

#### Paso 4: Ver Estados de Ejemplo

Si tienes contactos sincronizados, los primeros 10 contactos mostrarán estados de ejemplo como:
- "¡Hola a todos! 👋 Feliz de estar aquí"
- "Trabajando en nuevos proyectos 💼"
- "Un excelente día para todos ☀️"

## 🔍 Verificación Manual

### Verificar el Endpoint Directamente

Abre la consola del navegador (F12) y ejecuta:

\`\`\`javascript
// Reemplaza 'YOUR_SESSION_ID' con tu sessionId real
fetch('http://localhost:3002/api/whatsapp/statuses/YOUR_SESSION_ID')
  .then(r => r.json())
  .then(console.log)
\`\`\`

**Respuesta esperada:**

\`\`\`json
{
  "success": true,
  "statuses": [
    {
      "jid": "573001234567@s.whatsapp.net",
      "name": "Juan Pérez",
      "phone": "573001234567",
      "statuses": [
        {
          "id": "status-1",
          "type": "text",
          "caption": "¡Hola a todos! 👋",
          "timestamp": 1234567890
        }
      ],
      "unreadCount": 1
    }
  ],
  "message": "10 contactos"
}
\`\`\`

### Posibles Respuestas de Error

1. **"Sesión no activa"**
   - ✅ Solución: Conectar WhatsApp escaneando el QR

2. **"statuses": []**
   - ✅ Solución: Sincronizar contactos desde el módulo de Contactos

3. **Error 404**
   - ✅ Solución: Verificar que el servidor esté corriendo en puerto 3002

## 🐛 Debug en el Cliente

### Consola del Navegador

Abre la consola (F12) y busca estos logs:

\`\`\`
[STATUS-LIST] Estados de contactos cargados: 10
\`\`\`

Si ves:
\`\`\`
[STATUS-LIST] Error cargando estados de contactos: ...
\`\`\`

Revisa el error específico.

### Network Tab

1. Abre DevTools → Network
2. Filtra por "statuses"
3. Verifica que la petición a `/api/whatsapp/statuses/...` retorne 200 OK
4. Revisa la respuesta JSON

## 🔧 Solución Rápida

Si nada funciona, ejecuta este comando en el servidor:

\`\`\`bash
# Ver logs del servidor en tiempo real
pm2 logs whatsflow-server --lines 50
\`\`\`

Busca líneas como:
\`\`\`
[STATUSES-API] 📱 Solicitando estados...
[STATUSES-API] 👥 X contactos encontrados
[STATUSES-API] ✅ X contactos procesados
\`\`\`

## 📝 Nota Importante

Los estados que se muestran actualmente son **datos de ejemplo (mock)**.

Para ver estados reales de WhatsApp, necesitas implementar la integración con Baileys.

### Qué Hace el Sistema Ahora

1. ✅ Consulta contactos de la base de datos
2. ✅ Los primeros 10 contactos reciben estados de ejemplo
3. ✅ Muestra la interfaz completa funcional
4. ⚠️ NO consulta estados reales de WhatsApp (aún)

### Próximos Pasos para Estados Reales

1. Implementar listener de estados en Baileys
2. Guardar estados en base de datos
3. Reemplazar datos mock con datos reales

## 📞 Contacto

Si tienes problemas:

1. Revisa los logs: `pm2 logs whatsflow-server`
2. Verifica la consola del navegador (F12)
3. Comprueba que WhatsApp esté conectado
4. Sincroniza contactos nuevamente

---

**Última actualización:** Diciembre 2024
