/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.raw(`
    -- ============================================
    -- SISTEMA MULTI-AGENTE COMPLETO
    -- Sistema de roles, permisos y asignación de chats
    -- ============================================

    -- 1. Tabla de permisos del sistema
    CREATE TABLE IF NOT EXISTS permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        module VARCHAR(50) NOT NULL COMMENT 'chat, campaign, history, kanban, contacts, reports, settings',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    -- 2. Tabla de permisos por rol
    CREATE TABLE IF NOT EXISTS role_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role ENUM('admin', 'supervisor', 'agent') NOT NULL,
        permission_id INT NOT NULL,
        can_view BOOLEAN DEFAULT FALSE,
        can_create BOOLEAN DEFAULT FALSE,
        can_edit BOOLEAN DEFAULT FALSE,
        can_delete BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
        UNIQUE KEY unique_role_permission (role, permission_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    -- 3. Tabla de asignación de chats a agentes
    CREATE TABLE IF NOT EXISTS chat_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        chat_jid VARCHAR(255) NOT NULL,
        session_id VARCHAR(100) NOT NULL,
        user_id INT NOT NULL,
        assigned_by INT COMMENT 'ID del usuario que asignó (admin/supervisor)',
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('active', 'completed', 'transferred', 'closed') DEFAULT 'active',
        notes TEXT,
        completed_at TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_chat_user (chat_jid, user_id),
        INDEX idx_session (session_id),
        INDEX idx_user_status (user_id, status),
        INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    -- 4. Tabla de historial de transferencias de chats
    CREATE TABLE IF NOT EXISTS chat_transfers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        chat_jid VARCHAR(255) NOT NULL,
        session_id VARCHAR(100) NOT NULL,
        from_user_id INT NOT NULL,
        to_user_id INT NOT NULL,
        transferred_by INT NOT NULL,
        reason TEXT,
        transferred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (transferred_by) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_chat (chat_jid, session_id),
        INDEX idx_from_user (from_user_id),
        INDEX idx_to_user (to_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    -- 5. Tabla de configuración de permisos personalizados por usuario
    CREATE TABLE IF NOT EXISTS user_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        permission_id INT NOT NULL,
        can_view BOOLEAN DEFAULT FALSE,
        can_create BOOLEAN DEFAULT FALSE,
        can_edit BOOLEAN DEFAULT FALSE,
        can_delete BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_permission (user_id, permission_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    -- 6. Insertar permisos básicos del sistema
    INSERT INTO permissions (name, description, module) VALUES
    -- Chat
    ('chat.view', 'Ver chats asignados', 'chat'),
    ('chat.view_all', 'Ver todos los chats (admin)', 'chat'),
    ('chat.respond', 'Responder mensajes', 'chat'),
    ('chat.assign', 'Asignar chats a agentes', 'chat'),
    ('chat.transfer', 'Transferir chats entre agentes', 'chat'),
    ('chat.close', 'Cerrar conversaciones', 'chat'),

    -- Campañas
    ('campaign.view', 'Ver campañas', 'campaign'),
    ('campaign.create', 'Crear campañas', 'campaign'),
    ('campaign.edit', 'Editar campañas', 'campaign'),
    ('campaign.delete', 'Eliminar campañas', 'campaign'),
    ('campaign.send', 'Enviar campañas', 'campaign'),

    -- Historial
    ('history.view', 'Ver historial propio', 'history'),
    ('history.view_all', 'Ver todo el historial', 'history'),
    ('history.view_by_agent', 'Ver historial por agente', 'history'),
    ('history.export', 'Exportar historial', 'history'),

    -- Kanban
    ('kanban.view', 'Ver tablero Kanban', 'kanban'),
    ('kanban.edit', 'Editar tablero Kanban', 'kanban'),
    ('kanban.view_all', 'Ver todos los tableros', 'kanban'),

    -- Contactos
    ('contacts.view', 'Ver contactos', 'contacts'),
    ('contacts.create', 'Crear contactos', 'contacts'),
    ('contacts.edit', 'Editar contactos', 'contacts'),
    ('contacts.delete', 'Eliminar contactos', 'contacts'),
    ('contacts.import', 'Importar contactos', 'contacts'),
    ('contacts.export', 'Exportar contactos', 'contacts'),

    -- Reportes
    ('reports.view', 'Ver reportes básicos', 'reports'),
    ('reports.view_all', 'Ver todos los reportes', 'reports'),
    ('reports.export', 'Exportar reportes', 'reports'),

    -- Configuración
    ('settings.view', 'Ver configuración', 'settings'),
    ('settings.edit', 'Editar configuración', 'settings'),
    ('settings.users', 'Gestionar usuarios', 'settings'),
    ('settings.permissions', 'Gestionar permisos', 'settings')
    ON DUPLICATE KEY UPDATE description=VALUES(description);

    -- 7. Asignar permisos por defecto para ADMIN
    INSERT INTO role_permissions (role, permission_id, can_view, can_create, can_edit, can_delete)
    SELECT 'admin', id, TRUE, TRUE, TRUE, TRUE
    FROM permissions
    ON DUPLICATE KEY UPDATE can_view=TRUE, can_create=TRUE, can_edit=TRUE, can_delete=TRUE;

    -- 8. Asignar permisos por defecto para SUPERVISOR
    INSERT INTO role_permissions (role, permission_id, can_view, can_create, can_edit, can_delete)
    SELECT 'supervisor', id, 
        CASE 
            WHEN name IN ('chat.view_all', 'chat.assign', 'chat.transfer', 'history.view_all', 'history.view_by_agent', 'kanban.view_all', 'reports.view_all') THEN TRUE
            WHEN name LIKE '%.view' THEN TRUE
            ELSE FALSE
        END,
        CASE 
            WHEN name IN ('campaign.create', 'contacts.create') THEN TRUE
            ELSE FALSE
        END,
        CASE 
            WHEN name IN ('chat.respond', 'chat.close', 'campaign.edit', 'contacts.edit', 'kanban.edit') THEN TRUE
            ELSE FALSE
        END,
        FALSE
    FROM permissions
    ON DUPLICATE KEY UPDATE 
        can_view=VALUES(can_view), 
        can_create=VALUES(can_create), 
        can_edit=VALUES(can_edit), 
        can_delete=VALUES(can_delete);

    -- 9. Asignar permisos por defecto para AGENT
    INSERT INTO role_permissions (role, permission_id, can_view, can_create, can_edit, can_delete)
    SELECT 'agent', id,
        CASE 
            WHEN name IN ('chat.view', 'chat.respond', 'history.view', 'kanban.view', 'contacts.view', 'reports.view') THEN TRUE
            ELSE FALSE
        END,
        CASE 
            WHEN name IN ('contacts.create') THEN TRUE
            ELSE FALSE
        END,
        CASE 
            WHEN name IN ('chat.respond', 'contacts.edit') THEN TRUE
            ELSE FALSE
        END,
        FALSE
    FROM permissions
    ON DUPLICATE KEY UPDATE 
        can_view=VALUES(can_view), 
        can_create=VALUES(can_create), 
        can_edit=VALUES(can_edit), 
        can_delete=VALUES(can_delete);

    -- 10. Crear vista para facilitar consultas de permisos
    CREATE OR REPLACE VIEW v_user_permissions AS
    SELECT 
        u.id as user_id,
        u.name as user_name,
        u.email,
        u.user_type as role, -- Assuming 'user_type' in 'users' table maps to 'role'
        p.id as permission_id,
        p.name as permission_name,
        p.module,
        COALESCE(up.can_view, rp.can_view, FALSE) as can_view,
        COALESCE(up.can_create, rp.can_create, FALSE) as can_create,
        COALESCE(up.can_edit, rp.can_edit, FALSE) as can_edit,
        COALESCE(up.can_delete, rp.can_delete, FALSE) as can_delete
    FROM users u
    CROSS JOIN permissions p
    LEFT JOIN role_permissions rp ON u.user_type = rp.role AND p.id = rp.permission_id -- Assuming 'user_type' in 'users' table maps to 'role'
    LEFT JOIN user_permissions up ON u.id = up.user_id AND p.id = up.permission_id
    WHERE u.is_active = TRUE; -- Assuming 'status' in 'users' table is 'is_active'

    -- 11. Crear vista para chats asignados a agentes
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
        u.user_type as agent_role, -- Assuming 'user_type' in 'users' table maps to 'role'
        c.name as contact_name,
        c.jid as phone_number,
        c.avatar_url,
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
    WHERE ca.status = 'active' AND u.is_active = TRUE; -- Assuming 'status' in 'users' table is 'is_active'

    -- 12. Índices adicionales para optimización
    CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(user_type, is_active); -- Assuming 'user_type' and 'is_active'
    CREATE INDEX IF NOT EXISTS idx_chat_assignments_status_user ON chat_assignments(status, user_id);
    -- CREATE INDEX IF NOT EXISTS idx_messages_chat_timestamp ON messages(chat_jid, session_id, timestamp); -- This index is on an external table 'messages' which is not created in this migration. It should be handled separately if 'messages' table is part of this system.

    -- SELECT '✅ Sistema multi-agente instalado correctamente' as status; -- Not needed in migration
    -- SELECT COUNT(*) as total_permissions FROM permissions; -- Not needed in migration
    -- SELECT role, COUNT(*) as assigned_permissions FROM role_permissions GROUP BY role; -- Not needed in migration
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.raw(`
    DROP VIEW IF EXISTS v_user_permissions;
    DROP VIEW IF EXISTS v_agent_chats;
    DROP TABLE IF EXISTS chat_transfers;
    DROP TABLE IF EXISTS chat_assignments;
    DROP TABLE IF EXISTS user_permissions;
    DROP TABLE IF EXISTS role_permissions;
    DROP TABLE IF EXISTS permissions;
  `);
};
