# ✅ Cómo Probar la Funcionalidad de Estados

## 🎯 Estado Actual

**Todo está implementado y funcionando:**

✅ Componente StatusList mejorado
✅ Endpoint del servidor corregido
✅ Datos de ejemplo funcionando
✅ Servidor reiniciado y activo

## 🚀 Pasos para Probar

### 1. Acceder al Sistema

1. Abre tu navegador en: `http://localhost:3000` (o el dominio configurado)
2. Inicia sesión con tu cuenta de admin

### 2. Conectar WhatsApp (si no está conectado)

1. En el dashboard, busca el QR de WhatsApp
2. Escanea el código con tu teléfono
3. Espera a que diga "Conectado"

### 3. Ir al Módulo de Chat

1. En el menú lateral, haz clic en **"Chat"** o **"WhatsApp"**
2. Verás las pestañas superiores:
   - Todo
   - Enviados
   - Recibidos
   - Sin leer
   - **Estados** ← Esta es la nueva!

### 4. Abrir la Pestaña de Estados

1. Haz clic en la pestaña **"Estados"**
2. Verás dos sub-pestañas:
   - **Mis estados** (tus estados publicados)
   - **Recientes** (estados de contactos)

### 5. Ver Estados de Contactos

1. Asegúrate de estar en la sub-pestaña **"Recientes"**
2. Si tienes contactos sincronizados, verás:
   - **Los primeros 10 contactos** con estados de ejemplo
   - Avatar circular con borde verde
   - Badge con número de estados
   - Tiempo relativo ("Hace 2 horas", etc.)

### 6. Ver un Estado

1. Haz clic en cualquier contacto con estados
2. Se abrirá el visor de pantalla completa estilo Stories
3. Verás:
   - Header con nombre y tiempo
   - Barras de progreso (si hay múltiples estados)
   - El contenido del estado
4. **Navegar entre estados:**
   - Click en mitad izquierda = Estado anterior
   - Click en mitad derecha = Siguiente estado
   - Click en X = Cerrar

## 📱 Qué Deberías Ver

### Si Todo Funciona Correctamente:

**En la lista de recientes:**
```
┌─────────────────────────────────────┐
│  Mis estados  │ Recientes  │  🔄    │
├─────────────────────────────────────┤
│                                     │
│ ● Juan Pérez           [2]          │
│   Hace 2 horas                      │
│                                     │
│ ● María García         [1]          │
│   Hace 3 horas                      │
│                                     │
│ ● Carlos López         [3]          │
│   Hace 4 horas                      │
└─────────────────────────────────────┘
```

**Estados de ejemplo que verás:**
- "¡Hola a todos! 👋 Feliz de estar aquí"
- "Trabajando en nuevos proyectos 💼"
- "Un excelente día para todos ☀️"

### Si Ves "No hay estados disponibles":

Significa que no hay contactos sincronizados. Haz lo siguiente:

1. Ve al módulo **"Contactos"**
2. Haz clic en **"Sincronizar"** o **"Actualizar"**
3. Espera a que se descarguen los contactos
4. Vuelve a la pestaña de Estados
5. Haz clic en el botón **🔄** para actualizar

## 🔍 Verificación Técnica

### Consola del Navegador (F12)

Si abres la consola, deberías ver:

```javascript
[STATUS-LIST] Estados de contactos cargados: 10
```

### Network Tab (F12 → Network)

1. Filtra por "statuses"
2. Verás una petición a: `/api/whatsapp/statuses/[tu-session-id]`
3. Status: 200 OK
4. Response JSON con contactos y estados

### Ejemplo de Respuesta Esperada:

```json
{
  "success": true,
  "statuses": [
    {
      "jid": "5730012345678@s.whatsapp.net",
      "name": "Juan Pérez",
      "phone": "5730012345678",
      "statuses": [
        {
          "id": "...",
          "type": "text",
          "caption": "¡Hola a todos! 👋 Feliz de estar aquí",
          "timestamp": 1702845600000
        }
      ],
      "unreadCount": 1
    }
  ],
  "message": "10 contactos"
}
```

## 🐛 Solución de Problemas

### Error: "Sesión no activa"

**Causa:** WhatsApp no está conectado

**Solución:**
1. Ve al dashboard principal
2. Escanea el código QR
3. Espera a ver "Conectado"
4. Vuelve a Estados y haz clic en 🔄

### No aparecen contactos

**Causa:** No hay contactos en la base de datos

**Solución:**
1. Ve a Contactos
2. Sincroniza contactos
3. Vuelve a Estados

### Error 500 en el endpoint

**Causa:** Error en el servidor

**Solución:**
```bash
# Ver logs del servidor
pm2 logs whatsflow-server --lines 50

# Buscar líneas con [STATUSES-API]
```

### Los estados no cargan

**Solución Rápida:**
```bash
# Reiniciar servidor
pm2 restart whatsflow-server

# Limpiar caché del navegador
Ctrl + Shift + R (o Cmd + Shift + R en Mac)
```

## 📊 Logs del Servidor

Para ver qué está pasando en el servidor:

```bash
pm2 logs whatsflow-server --lines 50 | grep STATUSES
```

Deberías ver:
```
[STATUSES-API] 📱 Solicitando estados de contactos para session: xxx
[STATUSES-API] 👥 15 contactos encontrados
[STATUSES-API] ✅ 15 contactos procesados
```

## ⚠️ Importante: Datos de Ejemplo

**Los estados que ves son de EJEMPLO (mock data).**

Los primeros 10 contactos reciben automáticamente estados de prueba para que puedas ver cómo funciona la interfaz.

### Para ver estados reales de WhatsApp:

Necesitarás implementar la integración completa con Baileys. Por ahora, el sistema:

✅ Muestra la interfaz completa funcional
✅ Permite navegar entre estados
✅ Tiene tema oscuro
⚠️ Los estados son de ejemplo, no reales

## 📝 Checklist de Verificación

- [ ] Servidor corriendo (puerto 3002)
- [ ] Frontend corriendo (puerto 3000)
- [ ] WhatsApp conectado (QR escaneado)
- [ ] Contactos sincronizados
- [ ] Pestaña "Estados" visible en Chat
- [ ] Sub-pestañas "Mis estados" y "Recientes"
- [ ] Se ven contactos en "Recientes"
- [ ] Los contactos tienen badges con números
- [ ] Al hacer clic se abre el visor
- [ ] Se puede navegar entre estados
- [ ] El botón 🔄 actualiza la lista

## 🎉 Todo Funciona Si...

1. ✅ Ves la pestaña "Estados" en el módulo de Chat
2. ✅ Al hacer clic aparecen "Mis estados" y "Recientes"
3. ✅ En "Recientes" ves lista de contactos
4. ✅ Al hacer clic en un contacto se abre el visor
5. ✅ Puedes navegar entre estados con clicks
6. ✅ El tema es oscuro (fondo negro/gris oscuro)

## 🆘 Si Nada Funciona

1. **Verifica que el servidor esté corriendo:**
   ```bash
   pm2 status
   ```

2. **Revisa los logs:**
   ```bash
   pm2 logs whatsflow-server
   ```

3. **Verifica la URL del API:**
   - Abre consola del navegador (F12)
   - Ve a Network
   - Busca petición a `/api/whatsapp/statuses/`
   - Verifica que vaya a `localhost:3002`

4. **Limpia caché:**
   - Ctrl + Shift + Delete
   - Borra caché y cookies
   - Recarga la página

---

**Última actualización:** Diciembre 2024
**Versión:** 2.1 - Estados de WhatsApp Funcionales
