# 🔍 DIAGNÓSTICO - AGENTE NO RECIBE MENSAJES

## Problema
- ✅ Admin recibe TODO correctamente
- ❌ Agente funciona un rato, luego deja de recibir
- ❌ Al recargar página se desconecta WhatsApp (NO DEBERÍA)

## Verificación en Navegador

### 1. Abrir Consola del Navegador (F12)
Como **AGENTE**, busca estos logs:

```
✅ DEBE APARECER:
🔌 Socket conectado: xxxxx
🔌 [AGENTE] Uniéndose a sala agent-XX
✅ [AGENT-PRO] Confirmación de unión a sala

❌ SI APARECE:
🔌 Socket desconectado: transport close
🔌 Error de conexión
⚠️ [AGENT-PRO] No se puede unir a sala
```

### 2. Verificar sessionStorage
En la consola, ejecuta:
```javascript
console.log('userId:', sessionStorage.getItem('userId'));
console.log('userRole:', sessionStorage.getItem('userRole'));
console.log('whatsflow_session:', sessionStorage.getItem('whatsflow_session'));
```

**DEBE MOSTRAR:**
- userId: número (tu ID de agente)
- userRole: "agent"
- whatsflow_session: número de teléfono del admin

### 3. Verificar Socket Conectado
```javascript
// En la consola del navegador
window.socketConnected = true; // Marca temporal
```

Luego cuando llegue un mensaje, busca en logs:
```
💬 [AGENT-PRO] Nuevo mensaje recibido: {...}
```

## Posibles Causas

### A. Socket se desconecta después de 30s
**Síntoma:** Funciona al inicio, luego nada

**Causa:** Timeout del servidor o proxy nginx

**Solución:** Revisar configuración nginx

### B. No se une a sala agent-XX
**Síntoma:** No aparece log "Confirmación de unión a sala"

**Causa:** userId no está en sessionStorage

**Solución:** Verificar login de agente

### C. Eventos duplicados causan memory leak
**Síntoma:** Mensajes llegan 2-3 veces al inicio, luego nada

**Causa:** Listeners no se limpian al reconectar

**Solución:** Ya aplicada en código (pendiente compilar)

## Logs del Servidor

Ejecutar en servidor:
```bash
# Ver conexiones de agentes en tiempo real
pm2 logs whatsflow-backend --lines 100 | grep -E "(join-agent|agent-[0-9]+|Confirmación de unión)"

# Ver mensajes emitidos a agentes
pm2 logs whatsflow-backend --lines 100 | grep "emitido a agent-"
```

**DEBE MOSTRAR:**
```
✅ [AGENT-PRO] Confirmación de unión a sala agent-XX
📤 Mensaje emitido a agent-XX
```

## Test Manual

1. **Login como agente**
2. **Abrir consola (F12)**
3. **Verificar logs de conexión**
4. **Admin envía mensaje a chat asignado**
5. **Verificar en consola del agente:**
   ```
   💬 [AGENT-PRO] Nuevo mensaje recibido
   ```

## Correcciones Aplicadas

### ✅ Ya Aplicado
- Socket con reconexión automática (Infinity attempts)
- Re-join a sala agent-XX al reconectar
- Captura de campos multimedia en mensajes

### 🚧 Pendiente de Compilar
- Limpieza de listeners duplicados
- Prevención de memory leaks

## Próximos Pasos

1. **Usuario verifica logs en navegador**
2. **Usuario reporta qué logs aparecen**
3. **Aplicar correcciones específicas según diagnóstico**

---

**Última actualización:** 2025-11-25
