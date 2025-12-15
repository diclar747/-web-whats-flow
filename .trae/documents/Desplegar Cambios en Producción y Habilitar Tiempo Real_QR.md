## Causa Probable
- El dominio sirve build estático vía Nginx; el build no se ha actualizado o el CDN (Cloudflare) está cacheando HTML/assets.
- El backend sí está activo, pero el frontend que ves no incluye la nueva pestaña “Monitoreo de Chats” ni los fixes de eventos.

## Verificaciones Iniciales (sin cambios)
1. Comprobar qué está sirviendo Nginx: confirmar root de frontend apunta a `src/client/build`.
2. Validar `GET /api/health` y que Socket.IO está accesible por `wss` en el dominio.
3. Revisar si el HTML de `/` contiene el texto `Panel de Administración (Super Admin)` para confirmar versión del build.

## Despliegue Frontend
1. Compilar frontend: `npm run build`.
2. Asegurar que Nginx sirve `src/client/build` (según config actual).
3. Limpiar/rotar la carpeta `build` obsoleta y publicar la nueva (`rsync` o reemplazo atómico).
4. Purga de caché en Cloudflare (al menos `index.html`, `static/js/*`, `static/css/*`).
5. Reiniciar Nginx si aplica (solo si cambiamos configuración; para contenido estático no es necesario).

## Backend y Tiempo Real
1. Reiniciar PM2 del backend para cargar fixes de eventos (asignación/transferencia/aceptación/cierre) y ajuste de QR.
2. Validar emisión de eventos:
   - `agent-<id>-assignment`, `agent-<id>-transfer-accepted/rejected`, `agent-<id>-conversation-closed`.
   - `transfer-response` y `conversation-status-changed` visibles en admin monitor.
3. Confirmar Socket.IO rooms: `session-<id>` y `agent-<id>`.

## Validación Funcional
1. Admin: abrir “Monitoreo de Chats” y verificar:
   - Transferencia entra como notificación.
   - Aceptación/rechazo se reflejan con mensaje y estado.
   - Cierre de conversación genera evento y se muestra.
2. Agente claudio@cnid.com.py: recibir transferencia, aceptar/rechazar y ver actualización.
3. QR: desde la portada, generar QR y verificar aparición en < 10–15 s.

## Observabilidad
- Añadir logs de versión del frontend (hash del build) en consola y una ruta `GET /version` del backend para auditar despliegue.
- Habilitar headers `Cache-Control: no-cache` para `index.html` en Nginx, mantener cache agresivo sólo para `static/*`.

## Contingencia
- Si aún no se ven cambios, forzar bypass de cache: `?v=<build_hash>` al cargar la home y/o invalidar todo el caché del dominio temporalmente.
- Si el dominio usa otro servidor detrás, sincronizar la carpeta `build` en ese host y reiniciar su servicio.

¿Confirmo y ejecuto estos pasos ahora para que veas los cambios en `https://web.whats-flow.com/`? 