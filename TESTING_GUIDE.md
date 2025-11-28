# 🧪 Guía de Pruebas: Verificar Fixes del Chat Bidireccional

## Requisitos Previos
- [ ] Dos números de WhatsApp conectados (595984219248 y 595985768793)
- [ ] Acceso a ambas cuentas en la plataforma
- [ ] DevTools del navegador (F12)
- [ ] Acceso a base de datos (opcional)

---

## TEST 1: Carga de Mensajes Históricos ⏰

### Objetivo
Verificar que los mensajes de días anteriores se cargan correctamente

### Pasos
1. **Login con Usuario 595984219248**
   - Abre la plataforma
   - Inicia sesión con este número

2. **Encuentra un chat antiguo**
   - Busca un chat que tenga mensajes de hace 3+ días
   - Haz clic para abrir la conversación

3. **Observa los mensajes**
   - Abre DevTools (F12)
   - Console → Busca logs que digan: `✅ Mensajes cargados: X para chat`
   - Verifica que X > 0

4. **Resultado Esperado**
   ```
   ✅ Se cargan mensajes de hace 3+ días
   ✅ DevTools muestra: "✅ Mensajes cargados: 15 para chat 595985768793@s.whatsapp.net"
   ✅ NO muestra: "0" mensajes
   ```

### Si Falla
```bash
# Ejecuta en servidor:
mysql -u root -pPassword
SELECT COUNT(*) FROM messages 
WHERE phone_number = '595984219248' 
  AND timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
  LIMIT 1;
```

---

## TEST 2: Avatar Propio Oculto 🎭

### Objetivo
Verificar que tu número NO aparece en la lista de contactos

### Pasos
1. **Login con Usuario 595984219248**
   
2. **Observa la lista de contactos**
   - Mira la lista izquierda de contactos
   - Busca si aparece tu propio número (595984219248)

3. **Resultado Esperado**
   ```
   ✅ NO aparece 595984219248 en la lista
   ✅ Solo aparecen otros contactos (595985768793, otros, etc.)
   ✅ Si lo buscas en el buscador, tampoco aparece
   ```

### Si Falla
```javascript
// En DevTools Console:
// Busca este log:
// "[API] 🚫 Filtrando chat con propio número: 595984219248"

// O verifica directamente:
fetch('http://localhost:3001/api/chats/595984219248')
  .then(r => r.json())
  .then(d => console.log(d.chats.map(c => c.name)))
```

---

## TEST 3: Bidireccionalidad de Mensajes ⬌

### Objetivo
Verificar que los mensajes se envían y reciben correctamente en ambas direcciones

### Pasos (IMPORTANTE: Necesitas 2 navegadores/dispositivos)

#### Dispositivo 1 (Usuario A: 595984219248)
```
1. Abre navegador/app en Usuario A
2. Encuentra el chat con Usuario B (595985768793)
3. Escribe un mensaje: "TEST A→B"
4. Presiona enviar
5. Observa que aparece en tu chat como "Yo: TEST A→B"
```

#### Dispositivo 2 (Usuario B: 595985768793)
```
1. Abre navegador/app en Usuario B
2. Verifica que recibe el mensaje "TEST A→B"
3. Responde: "TEST B→A"
4. Presiona enviar
5. Observa que aparece en tu chat
```

#### De Vuelta en Dispositivo 1 (Usuario A)
```
1. Observa que recibes el mensaje "TEST B→A"
2. Abre DevTools (F12)
3. Console → Busca: "🎉🎉🎉 MENSAJE RECIBIDO"
4. Si lo ves, significa que llegó en tiempo real
```

### Resultado Esperado
```
✅ Usuario A envía → User B recibe
✅ Usuario B envía → Usuario A recibe
✅ DevTools muestra eventos de socket.io
✅ Ambos ven los mensajes en sus chats
✅ NO hay duplicados
✅ El orden es cronológico
```

### Si Falla (Debugging)

**En DevTools Console:**
```javascript
// Ver todos los eventos que lleguen
socket.on('message', (msg) => {
  console.log('📨 MENSAJE RECIBIDO:', msg);
});

// Ver si se emiten
socket.emit('debug', {
  sessionId: localStorage.getItem('sessionId'),
  time: new Date().toISOString()
});
```

**En Servidor:**
```bash
pm2 logs whatsflow-backend | grep "595984219248\|595985768793" | tail -50
```

**En BD:**
```sql
-- Ver últimos mensajes entre los dos números
SELECT id, sender_jid, chat_jid, from_me, timestamp, text_content 
FROM messages 
WHERE (session_id = '595984219248' OR phone_number = '595984219248')
  AND chat_jid = '595985768793@s.whatsapp.net'
ORDER BY timestamp DESC 
LIMIT 20;

-- Ver también desde la otra dirección
SELECT id, sender_jid, chat_jid, from_me, timestamp, text_content 
FROM messages 
WHERE (session_id = '595985768793' OR phone_number = '595985768793')
  AND chat_jid = '595984219248@s.whatsapp.net'
ORDER BY timestamp DESC 
LIMIT 20;
```

---

## TEST 4: Performance 🏃

### Objetivo
Verificar que la carga de chats es rápida

### Pasos
1. **Abre DevTools** (F12 → Network tab)
2. **Recarga la página**
3. **Observa las request**:
   - `GET /api/chats/595984219248` - Debe tomar < 2s
   - `GET /api/messages/595984219248?number=595985768793@s.whatsapp.net` - Debe tomar < 2s

4. **Resultado Esperado**
   ```
   ✅ /api/chats toma < 2 segundos
   ✅ /api/messages toma < 2 segundos
   ✅ La interfaz responde inmediatamente
   ✅ Los mensajes se cargan en < 5 segundos total
   ```

### Si es Lento
```bash
# En servidor, verifica los logs de API:
pm2 logs whatsflow-backend | grep "API-MSG\|CHATLIST" | tail -20

# Verifica performance de BD:
mysql -u root -pPassword
EXPLAIN SELECT * FROM messages 
WHERE chat_jid = '595985768793@s.whatsapp.net'
  AND phone_number = '595984219248'
  AND timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY);
```

---

## TEST 5: Orden Correcto de Mensajes 📋

### Objetivo
Verificar que los mensajes se muestran en orden cronológico correcto

### Pasos
1. **Abre un chat con varios mensajes**
2. **Observa el orden**:
   - Los más antiguos deben estar arriba
   - Los más recientes abajo
   - Cada mensaje debe tener timestamp visible

3. **Resultado Esperado**
   ```
   ✅ Orden: Antiguo → ... → Reciente
   ✅ Timestamps son correctos
   ✅ NO hay saltos de horas sin razón
   ```

---

## TEST 6: Sin Duplicados 🚫

### Objetivo
Verificar que no hay mensajes duplicados

### Pasos
1. **Abre un chat**
2. **Busca mensajes duplicados** (mismo contenido, mismo hora)
3. **Resultado Esperado**
   ```
   ✅ Cada mensaje aparece UNA SOLA VEZ
   ✅ NO hay duplicados
   ```

### Si Hay Duplicados
```javascript
// En DevTools:
const messages = document.querySelectorAll('.message-bubble');
const texts = Array.from(messages).map(m => m.textContent);
const duplicates = texts.filter((v, i, a) => a.indexOf(v) !== i);
console.log('Duplicados encontrados:', duplicates);
```

---

## 📊 Tabla de Verificación Final

| Test | Paso 1 | Paso 2 | Paso 3 | ✅/❌ |
|------|--------|--------|--------|-------|
| Mensajes históricos | Abre chat | Busca dev logs | Verifica > 0 | [ ] |
| Avatar oculto | Mira lista | Busca tu número | No debe aparecer | [ ] |
| Bidireccional A→B | Envía msg | Recibe en B | Ve en consola | [ ] |
| Bidireccional B→A | Responde | Recibe en A | Ve en consola | [ ] |
| Performance | Mide tiempo | < 2s por API | Total < 5s | [ ] |
| Orden correcto | Abre chat | Verifica orden | Antiguo→Reciente | [ ] |
| Sin duplicados | Busca dup | Revisa console | Count = 1 | [ ] |

---

## 🆘 Comandos de Emergencia

### Si Nada Funciona: Reiniciar Servidor
```bash
pm2 restart whatsflow-backend
pm2 logs whatsflow-backend  # Ver logs en tiempo real
```

### Si Hay Error de BD
```bash
# Verificar conexión BD
mysql -u root -pPassword -e "SELECT 1;"

# Ver estado de tablas
mysql -u root -pPassword -e "SHOW TABLES FROM whatsapp_db;"
```

### Si Quieres Limpiar Caché del Navegador
```javascript
// En DevTools Console:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### Si Quieres Revertir los Cambios (SOLO SI ALGO SALE MAL)
Editar `/var/www/web.whats-flow.com/src/server/index.js`:
- Línea 3086: Cambiar `INTERVAL 7 DAY` por `= CURDATE()` (volverá a solo HOY)
- Línea 8051: Cambiar `INTERVAL 7 DAY` por `= CURDATE()` (volverá a solo HOY)
- Luego: `pm2 restart whatsflow-backend`

---

## 📞 Soporte

Si después de todas estas pruebas aún hay problemas:

1. **Recopila logs**:
   ```bash
   pm2 logs whatsflow-backend > /tmp/server_logs.txt 2>&1
   ```

2. **Recopila datos de BD**:
   ```bash
   mysql -u root -pPassword -e "SELECT * FROM messages WHERE phone_number='595984219248' LIMIT 100;" > /tmp/db_export.txt
   ```

3. **Captura de pantalla**:
   - DevTools con los errores
   - Lista de chats
   - Chat con los mensajes no funcionando

4. **Reporta con**:
   - Logs del servidor
   - Datos de BD
   - Screenshots
   - Descripción exacta del problema

---

**Última actualización**: 28-11-2025  
**Estado**: ✅ Ready to Test
