-- ============================================
-- FIX COMPLETO DEL SISTEMA DE AGENTES
-- ============================================

-- 1. Limpiar tablas de grupos y miembros
TRUNCATE TABLE contact_group_members;
TRUNCATE TABLE contact_groups;

-- 2. La tabla user_permissions ya existe con permission_id

-- 3. Asegurarse que la tabla chat_assignments existe
CREATE TABLE IF NOT EXISTS chat_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    chat_jid VARCHAR(255) NOT NULL,
    user_id INT NOT NULL,
    assigned_by INT DEFAULT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('active', 'completed', 'transferred', 'cancelled') DEFAULT 'active',
    notes TEXT,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_session_chat (session_id, chat_jid),
    INDEX idx_status (status),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Verificar que el agente de prueba tiene permisos por defecto
DELETE FROM user_permissions WHERE user_id = 4;

INSERT INTO user_permissions (user_id, permission_id, can_view, can_create, can_edit, can_delete)
VALUES 
(4, 'chats', TRUE, TRUE, TRUE, FALSE),
(4, 'contacts', TRUE, FALSE, FALSE, FALSE),
(4, 'messages', TRUE, TRUE, FALSE, FALSE);

-- 5. Limpiar asignaciones antiguas del agente de prueba
DELETE FROM chat_assignments WHERE user_id = 4 AND status = 'active';

SELECT 'Script de corrección ejecutado exitosamente' as mensaje;
