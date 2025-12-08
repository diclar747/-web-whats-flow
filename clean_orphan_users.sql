-- Eliminar usuarios huérfanos (sin email, sin session_id, sin admin_phone)
-- Estos son registros antiguos o de prueba que no están relacionados correctamente con un admin

DELETE FROM users 
WHERE role = 'agent' 
  AND email IS NULL 
  AND session_id IS NULL 
  AND admin_phone IS NULL;

-- Verificar usuarios restantes
SELECT id, name, email, role, session_id, admin_phone, created_at 
FROM users 
ORDER BY created_at DESC;
