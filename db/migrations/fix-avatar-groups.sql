-- Fix v_agent_chats view to include avatars from both contacts and contact_groups

DROP VIEW IF EXISTS v_agent_chats;

CREATE OR REPLACE VIEW v_agent_chats AS
SELECT 
    ca.id as assignment_id,
    ca.chat_jid,
    ca.session_id,
    ca.user_id,
    ca.status as assignment_status,
    ca.assigned_at,
    ca.notes,
    u.name as agent_name,
    u.email as agent_email,
    u.role as agent_role,
    COALESCE(c.name, cg.name) as contact_name,
    COALESCE(c.jid, cg.jid) as phone_number,
    COALESCE(c.avatar_url, cg.avatar_url) as avatar_url,
    (SELECT COUNT(*) FROM messages m 
     WHERE m.chat_jid = ca.chat_jid 
     AND m.session_id = ca.session_id 
     AND m.from_me = 0 
     AND m.timestamp > ca.assigned_at) as unread_count,
    (SELECT MAX(timestamp) FROM messages m 
     WHERE m.chat_jid = ca.chat_jid 
     AND m.session_id = ca.session_id) as last_message_time,
    (SELECT text_content FROM messages m 
     WHERE m.chat_jid = ca.chat_jid 
     AND m.session_id = ca.session_id 
     ORDER BY timestamp DESC LIMIT 1) as last_message
FROM chat_assignments ca
JOIN users u ON ca.user_id = u.id
LEFT JOIN contacts c ON ca.chat_jid = c.jid AND ca.session_id = c.session_id
LEFT JOIN contact_groups cg ON ca.chat_jid = cg.jid AND ca.session_id = cg.session_id
WHERE ca.status = 'active' AND u.status = 'active';

SELECT '✅ Vista v_agent_chats actualizada para incluir avatares de grupos' as status;
