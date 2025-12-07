-- Corregir usuarios sin session_id asignándoles su admin_phone si existe
UPDATE users 
SET session_id = admin_phone 
WHERE session_id IS NULL AND admin_phone IS NOT NULL;

-- Verificar si quedó alguno sin session_id (que sea agente)
SELECT id, name, email, role, admin_phone, session_id FROM users WHERE session_id IS NULL AND role != 'admin';
