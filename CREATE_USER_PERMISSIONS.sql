-- ====================================================================
-- CREAR TABLA user_permissions PARA SISTEMA DE PERMISOS DE AGENTES
-- Ejecutar con: mysql -u root -p'Langostino#23' whatsflow < CREATE_USER_PERMISSIONS.sql
-- ====================================================================

-- Crear tabla user_permissions si no existe
CREATE TABLE IF NOT EXISTS user_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    module VARCHAR(100) NOT NULL,
    can_view BOOLEAN DEFAULT TRUE,
    can_create BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_module (user_id, module),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_module (module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT '✅ Tabla user_permissions creada correctamente' AS Status;

-- Insertar permisos por defecto para agentes existentes
INSERT IGNORE INTO user_permissions (user_id, module, can_view, can_create, can_edit, can_delete)
SELECT id, 'chat', TRUE, TRUE, FALSE, FALSE
FROM users 
WHERE role = 'agent'
AND id NOT IN (SELECT user_id FROM user_permissions WHERE module = 'chat');

INSERT IGNORE INTO user_permissions (user_id, module, can_view, can_create, can_edit, can_delete)
SELECT id, 'contacts', TRUE, FALSE, TRUE, FALSE
FROM users 
WHERE role = 'agent'
AND id NOT IN (SELECT user_id FROM user_permissions WHERE module = 'contacts');

SELECT '✅ Permisos por defecto asignados a agentes existentes' AS Status;
SELECT '✅✅✅ CONFIGURACIÓN DE PERMISOS COMPLETADA ✅✅✅' AS Status;
