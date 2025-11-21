# 🧪 INSTRUCCIONES DE PRUEBA - SISTEMA DE AGENTES

## 📋 Pre-requisitos
- ✅ Servidor funcionando: `pm2 status` debe mostrar "online"
- ✅ Base de datos limpia y configurada
- ✅ Usuario agente creado: claudio@cnid.com.py
- ✅ Permisos asignados correctamente

---

## 🔄 FLUJO DE PRUEBA COMPLETO

### PASO 1: Login como Admin
1. Abrir navegador en: https://web.whats-flow.com/
2. Escanear código QR con WhatsApp
3. Esperar conexión exitosa
4. Navegar a https://web.whats-flow.com/dashboard

### PASO 2: Verificar Chats del Admin
1. En el dashboard, ver lista de chats disponibles
2. Seleccionar un chat de prueba (puede ser cualquier contacto)
3. Abrir el chat y ver el historial

### PASO 3: Transferir Chat a Agente
1. Con el chat abierto, clic en menú (3 puntos verticales)
2. Buscar opción "Transferir a agente" o "Asignar a agente"
3. Seleccionar "claudio" de la lista de agentes
4. Confirmar la transferencia
5. Ver mensaje de confirmación

### PASO 4: Login como Agente (Nueva Pestaña)
1. Abrir nueva pestaña/ventana del navegador
2. Ir a: https://web.whats-flow.com/login
3. Ingresar credenciales:
   - **Email:** claudio@cnid.com.py
   - **Password:** 1234567
4. Clic en "Iniciar Sesión"
5. Debe redirigir a: https://web.whats-flow.com/dashboard

### PASO 5: Verificar Panel de Agente
Debe ver:
- ✅ Barra superior verde con "WhatsFlow - Panel de Agente (claudio)"
- ✅ Contador de chats asignados
- ✅ Panel izquierdo con lista de chats
- ✅ Chat transferido en la lista con:
  - Avatar del contacto
  - Nombre del contacto
  - Último mensaje
  - Hora

### PASO 6: Abrir Chat y Verificar Mensajes
1. Clic en el chat transferido
2. Debe verse:
   - ✅ Header con nombre y avatar del contacto
   - ✅ Historial de mensajes completo
   - ✅ Mensajes del contacto en burbujas blancas (izquierda)
   - ✅ Mensajes propios en burbujas verdes (derecha)
   - ✅ Hora de cada mensaje
   - ✅ Indicadores de estado (✓ enviado, ✓✓ entregado, ✓✓ azul leído)

### PASO 7: Enviar Mensaje desde Panel de Agente
1. En el campo inferior, escribir un mensaje de prueba: "Hola, soy el agente"
2. Presionar Enter o clic en botón de enviar (azul)
3. Verificar:
   - ✅ Mensaje aparece inmediatamente en la conversación (burbuja verde)
   - ✅ Indicador de "enviando" mientras se procesa
   - ✅ Estado del mensaje cambia a "enviado" ✓
   - ✅ Después cambia a "entregado" ✓✓

### PASO 8: Verificar Mensaje en WhatsApp Real
1. Abrir WhatsApp en el teléfono
2. Buscar el contacto al que se envió el mensaje
3. Verificar que el mensaje llegó correctamente
4. Responder desde WhatsApp

### PASO 9: Verificar Recepción en Panel de Agente
1. Volver al panel de agente en el navegador
2. En máximo 5 segundos debe aparecer el nuevo mensaje
3. Verificar que:
   - ✅ Mensaje aparece en burbuja blanca (izquierda)
   - ✅ Nombre del contacto sobre el mensaje
   - ✅ Hora correcta
   - ✅ Lista de chats actualizada con el último mensaje

### PASO 10: Probar Notificaciones
1. Con el panel de agente abierto, volver a la pestaña del admin
2. Transferir otro chat diferente al agente "claudio"
3. En el panel de agente debe:
   - ✅ Sonar notificación de audio
   - ✅ Mostrar notificación del navegador (si permisos están activados)
   - ✅ Aparecer alerta tipo Snackbar en la esquina superior derecha
   - ✅ Nuevo chat agregarse a la lista automáticamente

---

## 🎨 CARACTERÍSTICAS A VERIFICAR

### Interfaz:
- [ ] Diseño tipo WhatsApp Web
- [ ] Colores correctos (verde #00a884, gris #f0f2f5)
- [ ] Burbujas de mensaje con colores correctos
- [ ] Scroll automático a nuevos mensajes
- [ ] Búsqueda de chats funcional
- [ ] Responsive (prueba en diferentes tamaños de ventana)

### Funcionalidades:
- [ ] Login de agente funciona
- [ ] Lista de chats carga correctamente
- [ ] Mensajes históricos se cargan completos
- [ ] Envío de mensajes funciona
- [ ] Auto-refresh cada 5 segundos
- [ ] Notificaciones de nuevos chats
- [ ] Socket.IO conectado (verificar consola del navegador)
- [ ] Estados de mensaje (enviado/entregado/leído)

### Performance:
- [ ] Carga rápida inicial
- [ ] No recarga toda la página innecesariamente
- [ ] Solo actualiza mensajes cuando hay chat seleccionado
- [ ] No hay errores en consola del navegador
- [ ] No hay errores en logs del servidor

---

## 🐛 TROUBLESHOOTING

### Problema: No aparecen chats en el panel de agente
**Solución:**
```bash
# Verificar que hay chats asignados
mysql -u root -pWhatsFlow2024! whatsflow -e "SELECT * FROM chat_assignments WHERE user_id=4 AND status='active';"

# Si no hay, transferir un chat desde el admin
```

### Problema: No se envían mensajes
**Solución:**
```bash
# Verificar sesión de WhatsApp activa
mysql -u root -pWhatsFlow2024! whatsflow -e "SELECT phone_number, is_connected FROM whatsapp_sessions WHERE is_connected=1;"

# Verificar logs del servidor
pm2 logs whatsflow-server --lines 50
```

### Problema: Socket desconectado
**Solución:**
```bash
# Reiniciar servidor
pm2 restart whatsflow-server

# Recargar página del agente (F5)
```

### Problema: Notificaciones no funcionan
**Solución:**
1. Verificar permisos del navegador
2. En la barra de direcciones, clic en candado/información
3. Permitir notificaciones para el sitio

---

## ✅ CHECKLIST FINAL

- [ ] Admin puede transferir chats ✓
- [ ] Agente puede hacer login ✓
- [ ] Agente ve lista de chats asignados ✓
- [ ] Agente puede abrir chats y ver historial ✓
- [ ] Agente puede enviar mensajes ✓
- [ ] Mensajes enviados llegan a WhatsApp real ✓
- [ ] Respuestas de WhatsApp llegan al panel ✓
- [ ] Notificaciones funcionan ✓
- [ ] Auto-refresh funciona ✓
- [ ] Sin errores en consola ✓
- [ ] Sin errores en logs del servidor ✓

---

## 📊 VERIFICAR EN CONSOLA DEL NAVEGADOR

Abrir DevTools (F12) y buscar estos mensajes:

```
✅ [AGENT-DASHBOARD] Inicializando...
✅ AgentId establecido: 4
✅ SessionId desde BD: [sessionId]
🔌 [AGENT-DASHBOARD] Socket conectado, escuchando eventos para agente: 4
✅ Chats cargados exitosamente: [N]
```

Si hay errores, copiar y reportar.

---

## 📞 SOPORTE

Si hay problemas:
1. Capturar logs: `pm2 logs whatsflow-server --lines 100 > error.log`
2. Capturar consola del navegador (DevTools > Console > Copy all)
3. Verificar estado de la BD con los comandos SQL arriba
4. Reportar con toda la información

---

**¡Listo para probar! 🚀**
