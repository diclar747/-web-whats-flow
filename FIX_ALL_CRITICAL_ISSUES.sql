-- ============================================
-- CORRECCIONES CRÍTICAS DEL SISTEMA
-- ============================================

-- 1. Asegurarse que todos los agentes tengan admin_phone configurado
UPDATE users 
SET admin_phone = '595985768793' 
WHERE role = 'agent' AND (admin_phone IS NULL OR admin_phone = '');

-- 2. Verificar tabla user_permissions existe
CREATE TABLE IF NOT EXISTS user_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    module_name VARCHAR(100) NOT NULL,
    can_view BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_create BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_module (user_id, module_name)
);

-- 3. Asignar permisos básicos a agente claudio si no tiene
INSERT IGNORE INTO user_permissions (user_id, module_name, can_view, can_edit, can_create, can_delete)
VALUES 
    (4, 'chats', 1, 1, 1, 0),
    (4, 'contacts', 1, 0, 0, 0),
    (4, 'messages', 1, 1, 1, 0);

-- 4. Limpiar grupos y miembros (como solicitado)
DELETE FROM contact_group_members;
DELETE FROM contact_groups;

-- 5. Verificar appointment_categories table tiene sessionId como session_id
ALTER TABLE appointment_categories 
    MODIFY COLUMN session_id VARCHAR(100) NOT NULL;

SELECT '✅ Correcciones aplicadas exitosamente' AS resultado;
