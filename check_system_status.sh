#!/bin/bash

echo "=========================================="
echo "   WHATSFLOW - ESTADO DEL SISTEMA"
echo "=========================================="
echo ""

echo "📦 1. ESTADO DE PM2:"
pm2 status
echo ""

echo "📊 2. MEMORIA Y CPU:"
pm2 monit --no-interaction | head -10
echo ""

echo "👥 3. USUARIOS Y AGENTES:"
mysql -u root -pWhatsFlow2024! whatsflow -e "
SELECT 
    u.id, 
    u.name, 
    u.email, 
    u.role,
    u.status,
    COUNT(DISTINCT up.id) as permissions_count,
    COUNT(DISTINCT ca.id) as active_chats
FROM users u
LEFT JOIN user_permissions up ON u.id = up.user_id
LEFT JOIN chat_assignments ca ON u.id = ca.user_id AND ca.status = 'active'
WHERE u.role IN ('admin', 'agent')
GROUP BY u.id, u.name, u.email, u.role, u.status;" 2>/dev/null
echo ""

echo "💬 4. CHATS ASIGNADOS:"
mysql -u root -pWhatsFlow2024! whatsflow -e "
SELECT 
    u.name as agente,
    COUNT(ca.id) as total_chats,
    SUM(CASE WHEN ca.status='active' THEN 1 ELSE 0 END) as activos,
    SUM(CASE WHEN ca.status='completed' THEN 1 ELSE 0 END) as completados
FROM users u
LEFT JOIN chat_assignments ca ON u.id = ca.user_id
WHERE u.role = 'agent'
GROUP BY u.id, u.name;" 2>/dev/null
echo ""

echo "📱 5. SESIONES DE WHATSAPP:"
mysql -u root -pWhatsFlow2024! whatsflow -e "
SELECT 
    session_id,
    phone_number,
    is_connected,
    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as created,
    DATE_FORMAT(updated_at, '%H:%i:%s') as last_update
FROM whatsapp_sessions
ORDER BY updated_at DESC
LIMIT 5;" 2>/dev/null
echo ""

echo "🔐 6. PERMISOS DE AGENTES:"
mysql -u root -pWhatsFlow2024! whatsflow -e "
SELECT 
    u.name as agente,
    up.permission_id,
    IF(up.can_view=1, '✓', '✗') as ver,
    IF(up.can_create=1, '✓', '✗') as crear,
    IF(up.can_edit=1, '✓', '✗') as editar,
    IF(up.can_delete=1, '✓', '✗') as eliminar
FROM user_permissions up
JOIN users u ON up.user_id = u.id
WHERE u.role = 'agent'
ORDER BY u.name, up.permission_id;" 2>/dev/null
echo ""

echo "📈 7. MENSAJES RECIENTES (ÚLTIMOS 5):"
mysql -u root -pWhatsFlow2024! whatsflow -e "
SELECT 
    chat_jid,
    IF(from_me=1, 'YO', 'CONTACTO') as origen,
    LEFT(text_content, 50) as mensaje,
    status,
    DATE_FORMAT(timestamp, '%H:%i:%s') as hora
FROM messages
ORDER BY timestamp DESC
LIMIT 5;" 2>/dev/null
echo ""

echo "🌐 8. ÚLTIMAS LÍNEAS DEL LOG:"
pm2 logs whatsflow-server --lines 10 --nostream 2>&1 | tail -15
echo ""

echo "=========================================="
echo "   ✅ REVISIÓN COMPLETA"
echo "=========================================="
echo ""
echo "URLs importantes:"
echo "  - Panel Admin:  https://web.whats-flow.com/dashboard"
echo "  - Login Agente: https://web.whats-flow.com/login"
echo "  - GitHub Repo:  https://github.com/diclar747/-web-whats-flow"
echo ""
echo "Agente de prueba:"
echo "  - Email:    claudio@cnid.com.py"
echo "  - Password: 1234567"
echo ""
echo "Comandos útiles:"
echo "  - Ver logs:      pm2 logs whatsflow-server"
echo "  - Reiniciar:     pm2 restart whatsflow-server"
echo "  - Estado DB:     mysql -u root -pWhatsFlow2024! whatsflow"
echo ""
