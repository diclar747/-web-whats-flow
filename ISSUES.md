# PROBLEMAS CRÍTICOS IDENTIFICADOS - 07/12/2025 01:38

## 1. ❌ HISTORIAL NO CARGA
**Causa:** Después de limpiar `user_sessions`, `getAllSessionIds()` no encuentra registros
**Solución:** Agregado log y asegurar que siempre retorna al menos el sessionId original
**Estado:** ✅ ARREGLADO (reinicio pendiente de verificar)

## 2. ❌ CAMPAÑAS PROGRAMADAS NO SE EJECUTAN
**Causa:** El scheduler no está mostrando logs, posiblemente no se está ejecutando
**Campaña actual:** ID 1, programada para 00:33:00, ya pasó la hora (ahora 01:38)
**Solución necesaria:** 
- Verificar que el setInterval del scheduler se ejecuta
- Agregar logs más visibles
- Ejecutar manualmente la campaña pendiente

## 3. ❌ ERROR 400 AL CAMBIAR ESTADO DE AGENTE
**Endpoint:** PUT /api/agents/2/status
**Causa:** Probablemente validación de status incorrecta
**Solución necesaria:** Revisar endpoint y validaciones

## 4. ❌ TRANSFERIR CHAT NO FUNCIONA
**Causa:** Desconocida, funcionaba antes
**Solución necesaria:** Revisar endpoint de transferencia

## PRIORIDAD DE RESOLUCIÓN:
1. Scheduler (más crítico - campañas no se envían)
2. Historial (verificar si ya funciona)
3. Estado de agente
4. Transferencia de chat
