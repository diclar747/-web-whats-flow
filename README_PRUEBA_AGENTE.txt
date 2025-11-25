╔══════════════════════════════════════════════════════════╗
║  🔧 SISTEMA ACTUALIZADO - PRUEBA DE AGENTES             ║
╚══════════════════════════════════════════════════════════╝

✅ CORRECCIONES APLICADAS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ✅ Base de datos - phone_number sincronizado (7567 contactos)
2. ✅ Query de chats de agentes corregida
3. ✅ Frontend - Captura de campos multimedia mejorada
4. ✅ Backend - Logs de debug agregados

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧪 CÓMO PROBAR:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. LOGIN COMO AGENTE
   - Abrir https://web.whats-flow.com
   - Entrar con usuario/contraseña de agente
   - Abrir consola del navegador (F12)

2. VERIFICAR CONEXIÓN
   Buscar en consola:
   
   ✅ DEBE APARECER:
   🔌 Socket conectado: xxxxx
   🔌 [AGENTE] Uniéndose a sala agent-XX
   ✅ [AGENT-PRO] Confirmación de unión a sala
   
   ❌ SI NO APARECE: Reportar qué mensaje sale

3. ENVIAR MENSAJE DESDE ADMIN
   - Admin envía mensaje (texto) al chat asignado
   - Verificar que agente lo ve inmediatamente
   
4. ENVIAR MULTIMEDIA DESDE ADMIN
   - Admin envía: 📷 imagen, 🎵 audio, 🎥 video
   - Verificar que agente lo recibe

5. VERIFICAR NOMBRES DE CHATS
   - Los chats deben mostrar NOMBRE real
   - NO deben mostrar "0"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 LOGS DEL SERVIDOR:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Para ver si el servidor emite correctamente:

pm2 logs whatsflow-backend --lines 50

BUSCAR:
🎯 Emitiendo a agent-X (N sockets conectados)
✅ Mensaje emitido a agent-X

SI APARECE:
⚠️ Sala agent-X VACÍA - Mensaje no se entregará
SIGNIFICA: El agente NO está conectado a su sala

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🐛 SI SIGUE FALLANDO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. TOMAR SCREENSHOT de la consola del navegador (F12)
2. COPIAR el output de: pm2 logs whatsflow-backend --lines 100
3. VERIFICAR en consola del navegador:

   sessionStorage.getItem('userId')      → Debe ser número
   sessionStorage.getItem('userRole')    → Debe ser "agent"
   sessionStorage.getItem('whatsflow_session') → Debe ser número

4. REPORTAR:
   - ¿Aparece "Confirmación de unión a sala"?
   - ¿Cuánto tiempo funciona antes de fallar?
   - ¿Qué pasa cuando recarga la página?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 ARCHIVOS CREADOS:
- DIAGNOSTICO_AGENTE.md (guía detallada)
- FIX_MULTIMEDIA_AGENTES.md (resumen técnico)
- SYNC_PHONE_NUMBERS.sql (script mantenimiento)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Última actualización: 2025-11-25 15:30
