# ⚠️ PROBLEMA: WhatsApp conectado pero avatares no se descargan

## Estado Actual

✅ **Servidor funcionando**: El servidor está activo
❌ **WhatsApp NO conectado en servidor**: Aunque tu teléfono tenga WhatsApp Web activo, el servidor no tiene la sesión
❌ **is_active = 0**: La sesión está inactiva en la base de datos
❌ **Avatares no se descargan**: Sin sesión activa, no puede descargar avatares

## Solución Inmediata

### Opción 1: Reconectar WhatsApp (RECOMENDADO)

1. **Abre el navegador** y ve a tu aplicación: `http://tu-dominio.com`

2. **Ve al módulo de "Conexión WhatsApp"** o donde tengas el botón "Conectar WhatsApp"

3. **Genera un nuevo QR**:
   - Haz clic en "Conectar WhatsApp"
   - Espera a que aparezca el código QR

4. **Escanea el QR desde tu teléfono**:
   - Abre WhatsApp en tu teléfono
   - Ve a: Menú (⋮) → Dispositivos vinculados
   - Toca "Vincular un dispositivo"
   - Escanea el QR que aparece en la pantalla

5. **Espera la confirmación**:
   - Deberías ver "WhatsApp conectado exitosamente!"
   - Los avatares comenzarán a descargarse automáticamente

6. **Verifica en los logs**:
   ```bash
   pm2 logs whatsflow-server --lines 50
   ```
   Deberías ver mensajes como:
   ```
   [sessionId] ¡WhatsApp conectado exitosamente!
   [sessionId] 🖼️ Iniciando descarga de avatares...
   [sessionId] 🔍 Buscando avatares para session_id en BD: 1
   [sessionId] 🖼️ Iniciando descarga de avatares para 2565 contactos...
   ```

### Opción 2: Forzar descarga manual (Si YA tienes WhatsApp conectado)

Si estás seguro que WhatsApp está conectado pero no descarga avatares:

1. **Verifica que la sesión esté activa**:
   ```bash
   mysql -u root -p'Diclar2024@' whatsflow -e "SELECT id, session_id, phone, is_active FROM user_sessions WHERE phone = '595985768793';"
   ```

2. **Si is_active = 0, actívala manualmente**:
   ```bash
   mysql -u root -p'Diclar2024@' whatsflow -e "UPDATE user_sessions SET is_active = 1 WHERE phone = '595985768793';"
   ```

3. **Llama al endpoint de descarga** (desde el navegador con DevTools):
   ```javascript
   // Abre las DevTools (F12) en el navegador
   // Pega esto en la consola:

   fetch('/api/update-contacts-avatars/1', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': 'Bearer ' + localStorage.getItem('token')
     }
   })
   .then(r => r.json())
   .then(data => {
     console.log('Resultado:', data);
     if (data.success) {
       alert('✅ Descarga de avatares iniciada!');
     } else {
       alert('❌ Error: ' + data.error);
     }
   })
   .catch(err => console.error('Error:', err));
   ```

4. **Repite la llamada varias veces** (cada llamada descarga 100 avatares):
   - Para 2,565 contactos necesitas ~26 llamadas
   - Espera 30 segundos entre cada llamada
   - O ejecuta un loop:
   ```javascript
   let count = 0;
   const interval = setInterval(() => {
     if (count >= 26) {
       clearInterval(interval);
       alert('✅ Descarga completa!');
       return;
     }

     fetch('/api/update-contacts-avatars/1', {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'Authorization': 'Bearer ' + localStorage.getItem('token')
       }
     })
     .then(r => r.json())
     .then(data => {
       count++;
       console.log(`Lote ${count}/26:`, data);
     });
   }, 30000); // Cada 30 segundos
   ```

## Verificación de Resultados

### Ver progreso en tiempo real:

```bash
# Ver logs de descarga de avatares
pm2 logs whatsflow-server --lines 0

# Ver cantidad de avatares descargados
mysql -u root -p'Diclar2024@' whatsflow -e "
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN avatar_url IS NOT NULL AND avatar_url != '' THEN 1 ELSE 0 END) as con_avatar,
  ROUND(SUM(CASE WHEN avatar_url IS NOT NULL AND avatar_url != '' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as porcentaje
FROM contacts
WHERE session_id = 1 AND jid LIKE '%@s.whatsapp.net';
"
```

### Ver avatares en el frontend:

Los avatares deberían aparecer automáticamente en:
- Lista de contactos
- Lista de chats
- Mensajes individuales
- Módulo de contactos
- Kanban

Si no aparecen, **recarga la página** (Ctrl + Shift + R para forzar recarga sin caché)

## Diagnóstico

### Verificar sesión activa:

```bash
# Ver sesiones en memoria (debe mostrar "Sesiones Activas: > 0")
pm2 logs whatsflow-server --lines 20 | grep "Sesiones Activas"

# Ver estado en BD
mysql -u root -p'Diclar2024@' whatsflow -e "SELECT * FROM user_sessions WHERE phone = '595985768793'\\G"
```

### Verificar que WhatsApp está conectado:

```bash
# Buscar logs de conexión
pm2 logs whatsflow-server --lines 200 | grep "WhatsApp conectado"

# Buscar logs de descarga de avatares
pm2 logs whatsflow-server --lines 200 | grep "Iniciando descarga de avatares"
```

## Notas Importantes

1. **WhatsApp Web Multi-Dispositivo**:
   - Tu teléfono puede tener WhatsApp Web activo en otro navegador/dispositivo
   - Cada sesión QR es independiente
   - Necesitas escanear un NUEVO QR desde la aplicación para conectar al servidor

2. **Reinicio del servidor**:
   - Al reiniciar PM2, las sesiones en memoria se pierden
   - Necesitas reconectar WhatsApp después de cada reinicio
   - La BD mantiene los datos pero no la conexión WebSocket

3. **Tiempo de descarga**:
   - 2,565 contactos × 200ms c/u = ~8.5 minutos
   - Más pausas entre lotes = ~15-20 minutos total
   - Es normal que tome tiempo

4. **Errores comunes**:
   - `WhatsApp no conectado` = Necesitas escanear QR
   - `0 contactos para descargar` = Problema de session_id (ya corregido)
   - `Error 400` = Token expirado, recarga la página

---

**Fecha**: 2025-12-26
**Estado**: Correcciones aplicadas, esperando reconexión de WhatsApp
