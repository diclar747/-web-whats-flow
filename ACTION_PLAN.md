# PLAN DE TRABAJO - 07/12/2025 01:59

## PROBLEMAS CRÍTICOS A RESOLVER

### 1. ❌ CAMPAÑAS PROGRAMADAS NO FUNCIONAN
**Causa raíz:** Después de reiniciar el servidor, el Map `sessions` se vacía
**Solución:**
- Implementar persistencia de sesiones o
- Reconstruir el Map desde la base de datos al iniciar
- Modificar scheduler para buscar sesiones activas correctamente

### 2. ❌ ERROR AL CAMBIAR ESTADO DE AGENTE
**Endpoint:** PUT /api/agents/:agentId/status
**Error:** 400 Bad Request
**Solución necesaria:**
- Revisar validaciones del endpoint
- Verificar qué datos se están enviando
- Corregir el endpoint

### 3. ❌ ADMIN NO VE ESTADO DEL AGENTE
**Problema:** Admin no puede ver si agente está online/ocupado/disponible/desconectado
**Solución necesaria:**
- Implementar actualización en tiempo real del estado
- Mostrar indicador visual en la UI
- Socket.IO para notificaciones en tiempo real

### 4. ❌ TRANSFERIR CHAT NO LLEGA AL AGENTE
**Problema:** Al transferir un chat, el agente no lo recibe
**Solución necesaria:**
- Revisar endpoint de transferencia
- Verificar que se emita evento Socket.IO correcto
- Asegurar que el agente reciba la notificación

### 5. ⚠️ VALIDACIÓN: NO TRANSFERIR A AGENTES DESCONECTADOS
**Requisito:** Solo mostrar agentes online para transferencia
**Solución necesaria:**
- Filtrar lista de agentes por estado
- Mostrar indicador de disponibilidad
- Prevenir transferencia a agentes offline

## ORDEN DE RESOLUCIÓN
1. Campañas programadas (más crítico)
2. Estado de agentes (cambiar y visualizar)
3. Transferencia de chat
4. Validaciones de transferencia
