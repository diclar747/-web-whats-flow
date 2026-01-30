const mysql = require('mysql2/promise');

/**
 * Ensures all necessary database tables exist and are up to date.
 * @param {Object} pool - MySQL connection pool
 */
async function initializeDatabase(pool) {
    console.log('[DB-INIT] Starting database initialization...');
    try {
        await createTables(pool);
        console.log('[DB-INIT] createTables() finished.');
        await migrateTables(pool);
        console.log('[DB-INIT] migrateTables() finished.');
    } catch (error) {
        console.error('[DB-INIT] ❌ Error initializing database:', error);
        throw error;
    }
}

async function createTables(pool) {
    console.log('[DB-TABLES] Starting createTables()...');
    let connection;
    try {
        connection = await pool.getConnection();

        // Tabla para SOLO contactos individuales (@s.whatsapp.net)
        await connection.query(
            'CREATE TABLE IF NOT EXISTS contacts ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'jid VARCHAR(255) NOT NULL,'
            + 'name VARCHAR(255),'
            + 'notify_name VARCHAR(255),'
            + 'session_id VARCHAR(255),'
            + 'avatar_url VARCHAR(1024),'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'UNIQUE KEY unique_contact_per_session (jid, session_id),'
            + 'INDEX idx_session_id (session_id)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        // Tabla para broadcasts y status
        await connection.query(
            'CREATE TABLE IF NOT EXISTS broadcasts ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'jid VARCHAR(255) NOT NULL,'
            + 'name VARCHAR(255),'
            + 'session_id VARCHAR(255),'
            + 'broadcast_type VARCHAR(50),'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'UNIQUE KEY unique_broadcast_per_session (jid, session_id),'
            + 'INDEX idx_session_id (session_id)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        // Tabla unificada para grupos de WhatsApp (@g.us) y organización personalizada
        await connection.query(
            'CREATE TABLE IF NOT EXISTS contact_groups ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'jid VARCHAR(255),'
            + 'name VARCHAR(255) NOT NULL,'
            + 'session_id VARCHAR(255),'
            + 'description TEXT,'
            + 'participants_count INT DEFAULT 0,'
            + 'is_announcement BOOLEAN DEFAULT FALSE,'
            + 'is_restricted BOOLEAN DEFAULT FALSE,'
            + 'avatar_url VARCHAR(1024),'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'UNIQUE KEY unique_group_per_session (jid, session_id),'
            + 'INDEX idx_session_id (session_id),'
            + 'INDEX idx_name (name)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        await connection.query(
            'CREATE TABLE IF NOT EXISTS contact_group_members ('
            + 'contact_id INT,'
            + 'group_id INT,'
            + 'PRIMARY KEY (contact_id, group_id),'
            + 'FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,'
            + 'FOREIGN KEY (group_id) REFERENCES contact_groups(id) ON DELETE CASCADE,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        await connection.query(
            'CREATE TABLE IF NOT EXISTS messages ('
            + 'id VARCHAR(255) PRIMARY KEY, '
            + 'session_id VARCHAR(255) NOT NULL,'
            + 'chat_jid VARCHAR(255) NOT NULL, '
            + 'sender_jid VARCHAR(255), '
            + 'from_me BOOLEAN NOT NULL,'
            + 'message_type VARCHAR(50), '
            + 'text_content TEXT,'
            + 'media_url VARCHAR(1024),'
            + 'media_mime_type VARCHAR(100),'
            + 'timestamp DATETIME NOT NULL,'
            + 'status VARCHAR(50) DEFAULT \'pending\', '
            + 'is_read BOOLEAN DEFAULT FALSE, '
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'FOREIGN KEY (chat_jid) REFERENCES contacts(jid) ON DELETE CASCADE,'
            + 'INDEX idx_session_id (session_id)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        await connection.query(
            'CREATE TABLE IF NOT EXISTS campaigns ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'session_id VARCHAR(255) NOT NULL,'
            + 'name VARCHAR(255) NOT NULL,'
            + 'message_template TEXT NOT NULL,'
            + 'use_random_timing BOOLEAN DEFAULT FALSE,'
            + 'random_timing_msg_count INT,'
            + 'random_timing_time_span_minutes INT,'
            + 'use_id_flow BOOLEAN DEFAULT FALSE,'
            + 'id_flow_size INT,'
            + 'status VARCHAR(50) DEFAULT \'pending\', '
            + 'scheduled_at DATETIME NULL, '
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        await connection.query(
            'CREATE TABLE IF NOT EXISTS campaign_recipients ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'campaign_id INT NOT NULL,'
            + 'contact_jid VARCHAR(255) NOT NULL,'
            + 'message_id VARCHAR(255), '
            + 'status VARCHAR(50) DEFAULT \'pending\', '
            + 'error_message TEXT,'
            + 'sent_at DATETIME,'
            + 'delivered_at DATETIME,'
            + 'read_at DATETIME,'
            + 'FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,'
            + 'FOREIGN KEY (contact_jid) REFERENCES contacts(jid) ON DELETE CASCADE,'
            + 'UNIQUE KEY unique_campaign_recipient (campaign_id, contact_jid)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        await connection.query(
            'CREATE TABLE IF NOT EXISTS personalized_campaigns ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'session_id VARCHAR(255) NOT NULL,'
            + 'name VARCHAR(255) NOT NULL,'
            + 'message_template TEXT NOT NULL,'
            + 'template_id INT NULL,'
            + 'excel_filename VARCHAR(255),'
            + 'status ENUM(\'draft\', \'active\', \'paused\', \'completed\') DEFAULT \'draft\','
            + 'total_recipients INT DEFAULT 0,'
            + 'sent_count INT DEFAULT 0,'
            + 'delivered_count INT DEFAULT 0,'
            + 'read_count INT DEFAULT 0,'
            + 'failed_count INT DEFAULT 0,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'INDEX idx_session (session_id),'
            + 'INDEX idx_status (status)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        await connection.query(
            'CREATE TABLE IF NOT EXISTS campaign_recipients_detailed ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'campaign_id INT NOT NULL,'
            + 'phone VARCHAR(20) NOT NULL,'
            + 'name VARCHAR(255) NOT NULL,'
            + 'amount DECIMAL(12,2) NOT NULL,'
            + 'due_day INT NOT NULL COMMENT \'Día del mes para vencimiento (1-31)\','
            + 'installments INT DEFAULT 1,'
            + 'paid BOOLEAN DEFAULT FALSE,'
            + 'status ENUM(\'pending\', \'sent\', \'delivered\', \'read\', \'failed\') DEFAULT \'pending\','
            + 'message_id VARCHAR(255),'
            + 'error_message TEXT,'
            + 'sent_at DATETIME NULL,'
            + 'delivered_at DATETIME NULL,'
            + 'read_at DATETIME NULL,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'FOREIGN KEY (campaign_id) REFERENCES personalized_campaigns(id) ON DELETE CASCADE,'
            + 'INDEX idx_campaign (campaign_id),'
            + 'INDEX idx_phone (phone),'
            + 'INDEX idx_due_day (due_day),'
            + 'INDEX idx_status (status),'
            + 'INDEX idx_paid (paid)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        await connection.query(
            'CREATE TABLE IF NOT EXISTS campaign_templates_predefined ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'name VARCHAR(255) NOT NULL,'
            + 'category ENUM(\'simple\', \'formal\', \'urgent\', \'installments\', \'custom\') DEFAULT \'custom\','
            + 'message_text TEXT NOT NULL,'
            + 'variables JSON COMMENT \'Lista de variables disponibles\','
            + 'is_active BOOLEAN DEFAULT TRUE,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'INDEX idx_category (category)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        await connection.query(
            'CREATE TABLE IF NOT EXISTS kanban_boards ('
            + 'id VARCHAR(255) PRIMARY KEY,'
            + 'session_id VARCHAR(255) NOT NULL,'
            + 'name VARCHAR(255) NOT NULL,'
            + 'color VARCHAR(20) DEFAULT \'#3b82f6\','
            + 'board_order INT DEFAULT 0,'
            + 'is_default BOOLEAN DEFAULT FALSE,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'INDEX idx_session_id (session_id)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        await connection.query(
            'CREATE TABLE IF NOT EXISTS kanban_contacts ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'board_id VARCHAR(255) NOT NULL,'
            + 'contact_jid VARCHAR(255) NOT NULL,'
            + 'notes TEXT,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'FOREIGN KEY (board_id) REFERENCES kanban_boards(id) ON DELETE CASCADE,'
            + 'INDEX idx_contact_jid (contact_jid),'
            + 'UNIQUE KEY unique_board_contact (board_id, contact_jid)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        try {
            await connection.query(
                'ALTER TABLE kanban_contacts ADD CONSTRAINT fk_kanban_contacts_jid '
                + 'FOREIGN KEY (contact_jid) REFERENCES contacts(jid) ON DELETE CASCADE'
            );
        } catch (fkError) {
            // Ignorar si ya existe
        }

        await connection.query(
            'CREATE TABLE IF NOT EXISTS chat_assignments ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'chat_jid VARCHAR(255) NOT NULL,'
            + 'session_id VARCHAR(255) NOT NULL,'
            + 'user_id INT,'
            + 'assigned_by INT,'
            + 'status VARCHAR(50) DEFAULT \'pending\','
            + 'assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'accepted_at TIMESTAMP NULL,'
            + 'closed_at TIMESTAMP NULL,'
            + 'notes TEXT,'
            + 'transfer_history JSON,'
            + 'INDEX idx_chat_jid (chat_jid),'
            + 'INDEX idx_session_id (session_id),'
            + 'INDEX idx_user_id (user_id),'
            + 'INDEX idx_status (status)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        await connection.query(
            'CREATE TABLE IF NOT EXISTS appointments ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'session_id VARCHAR(255) NOT NULL,'
            + 'patient_name VARCHAR(255) NOT NULL,'
            + 'patient_phone VARCHAR(20) NOT NULL,'
            + 'doctor_name VARCHAR(255),'
            + 'company_name VARCHAR(255),'
            + 'description TEXT,'
            + 'appointment_date DATE NOT NULL,'
            + 'appointment_time TIME NOT NULL,'
            + 'status ENUM(\'scheduled\', \'confirmed\', \'cancelled\', \'completed\') DEFAULT \'scheduled\','
            + 'notes TEXT,'
            + 'reminder_time INT DEFAULT 60,'
            + 'notification_template VARCHAR(255) DEFAULT \'default\','
            + 'category_id INT,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'INDEX idx_session (session_id),'
            + 'INDEX idx_date (appointment_date),'
            + 'INDEX idx_phone (patient_phone)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        await connection.query(
            'CREATE TABLE IF NOT EXISTS appointment_templates ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'session_id VARCHAR(255) NOT NULL,'
            + 'name VARCHAR(255) NOT NULL,'
            + 'message_text TEXT NOT NULL,'
            + 'variables JSON,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'INDEX idx_session (session_id)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        await connection.query(
            'CREATE TABLE IF NOT EXISTS appointment_reminder_config ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'session_id VARCHAR(255) NOT NULL,'
            + 'time_before_hours INT NOT NULL,'
            + 'template_id INT,'
            + 'is_enabled BOOLEAN DEFAULT TRUE,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'FOREIGN KEY (template_id) REFERENCES appointment_templates(id) ON DELETE SET NULL,'
            + 'INDEX idx_session (session_id)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        await connection.query(
            'CREATE TABLE IF NOT EXISTS appointment_reminders_sent ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'appointment_id INT NOT NULL,'
            + 'sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'hours_before INT NOT NULL,'
            + 'message_text TEXT,'
            + 'status ENUM(\'sent\', \'delivered\', \'read\', \'failed\') DEFAULT \'sent\','
            + 'error_message TEXT,'
            + 'FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,'
            + 'INDEX idx_appointment (appointment_id)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        await connection.query(
            'CREATE TABLE IF NOT EXISTS admin_users ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'email VARCHAR(255) UNIQUE NOT NULL,'
            + 'password VARCHAR(255) NOT NULL,'
            + 'name VARCHAR(255) NOT NULL,'
            + 'role ENUM(\'super_admin\', \'admin\', \'support\') DEFAULT \'admin\','
            + 'is_active BOOLEAN DEFAULT TRUE,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'last_login TIMESTAMP NULL,'
            + 'INDEX idx_email (email)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        await connection.query(
            'CREATE TABLE IF NOT EXISTS subscriptions ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'session_id VARCHAR(255) NOT NULL,'
            + 'plan_type ENUM(\'free\', \'basic\', \'pro\', \'enterprise\') DEFAULT \'free\','
            + 'status ENUM(\'active\', \'inactive\', \'suspended\', \'expired\') DEFAULT \'inactive\','
            + 'start_date DATE NOT NULL,'
            + 'end_date DATE NOT NULL,'
            + 'days_granted INT DEFAULT 0,'
            + 'features JSON,'
            + 'max_campaigns INT DEFAULT 0,'
            + 'max_contacts INT DEFAULT 0,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'activated_by INT,'
            + 'notes TEXT,'
            + 'FOREIGN KEY (activated_by) REFERENCES admin_users(id) ON DELETE SET NULL,'
            + 'INDEX idx_session (session_id),'
            + 'INDEX idx_status (status),'
            + 'INDEX idx_end_date (end_date)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        await connection.query(
            'CREATE TABLE IF NOT EXISTS agents ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'session_id VARCHAR(255) NOT NULL,'
            + 'name VARCHAR(255) NOT NULL,'
            + 'email VARCHAR(255) UNIQUE,'
            + 'phone VARCHAR(20),'
            + 'status ENUM(\'available\', \'busy\', \'away\', \'offline\') DEFAULT \'offline\','
            + 'max_concurrent_chats INT DEFAULT 10,'
            + 'current_chats INT DEFAULT 0,'
            + 'is_active BOOLEAN DEFAULT TRUE,'
            + 'avatar_url VARCHAR(500),'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'last_activity TIMESTAMP NULL,'
            + 'INDEX idx_session (session_id),'
            + 'INDEX idx_status (status),'
            + 'INDEX idx_email (email)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        await connection.query(
            'CREATE TABLE IF NOT EXISTS agent_chat_history ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'agent_id INT NOT NULL,'
            + 'chat_jid VARCHAR(255) NOT NULL,'
            + 'session_id VARCHAR(255) NOT NULL,'
            + 'assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'closed_at TIMESTAMP NULL,'
            + 'status ENUM(\'active\', \'closed\', \'transferred\') DEFAULT \'active\','
            + 'transferred_to INT,'
            + 'messages_count INT DEFAULT 0,'
            + 'notes TEXT,'
            + 'INDEX idx_agent (agent_id),'
            + 'INDEX idx_chat (chat_jid),'
            + 'INDEX idx_session (session_id),'
            + 'INDEX idx_status (status)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        await connection.query(
            'CREATE TABLE IF NOT EXISTS plans ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'name VARCHAR(255) NOT NULL,'
            + 'description TEXT,'
            + 'price DECIMAL(10, 2) NOT NULL,'
            + 'modules JSON,'
            + 'max_agents INT DEFAULT 1,'
            + 'max_sessions INT DEFAULT 1,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        await connection.query(
            'CREATE TABLE IF NOT EXISTS users ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'name VARCHAR(255) NOT NULL,'
            + 'email VARCHAR(255) UNIQUE,'
            + 'password VARCHAR(255) NOT NULL,'
            + 'role ENUM(\'admin\', \'agent\', \'supervisor\') DEFAULT \'agent\','
            + 'department VARCHAR(255),'
            + 'category VARCHAR(255),'
            + 'status ENUM(\'active\', \'inactive\', \'suspended\') DEFAULT \'active\','
            + 'avatar_url TEXT,'
            + 'phone VARCHAR(50),'
            + 'last_login TIMESTAMP NULL,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'subscription_plan VARCHAR(50),'
            + 'subscription_status ENUM(\'active\', \'inactive\', \'trial\', \'expired\', \'cancelled\') DEFAULT \'inactive\','
            + 'subscription_start_date DATETIME,'
            + 'subscription_end_date DATETIME,'
            + 'subscription_days INT DEFAULT 0,'
            + 'is_admin TINYINT(1) DEFAULT 0,'
            + 'is_super_admin TINYINT(1) DEFAULT 0,'
            + 'admin_phone VARCHAR(20),'
            + 'auto_sync TINYINT(1) DEFAULT 0,'
            + 'sync_completed TINYINT(1) DEFAULT 0,'
            + 'last_sync_date DATETIME,'
            + 'agent_id VARCHAR(255),'
            + 'INDEX idx_email (email),'
            + 'INDEX idx_role (role),'
            + 'INDEX idx_status (status),'
            + 'INDEX idx_admin_phone (admin_phone)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        await connection.query(
            'CREATE TABLE IF NOT EXISTS whatsapp_statuses ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'phone VARCHAR(50) NOT NULL,'
            + 'text_content TEXT,'
            + 'media_url VARCHAR(1024),'
            + 'media_type ENUM(\'text\',\'image\',\'video\') DEFAULT \'text\','
            + 'background_color VARCHAR(20),'
            + 'font_style VARCHAR(50),'
            + 'status VARCHAR(50) DEFAULT \'draft\','
            + 'views_count INT DEFAULT 0,'
            + 'error_message TEXT,'
            + 'published_at DATETIME NULL,'
            + 'expires_at DATETIME NULL,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'INDEX idx_phone (phone),'
            + 'INDEX idx_status (status)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        await connection.query(
            'CREATE TABLE IF NOT EXISTS status_schedules ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'session_id VARCHAR(50) NOT NULL,'
            + 'name VARCHAR(255) NOT NULL,'
            + 'interval_minutes INT DEFAULT 60,'
            + 'rotation_days INT DEFAULT 30,'
            + 'is_active BOOLEAN DEFAULT TRUE,'
            + 'current_index INT DEFAULT 0,'
            + 'next_publish_at DATETIME NULL,'
            + 'total_published INT DEFAULT 0,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'INDEX idx_session (session_id),'
            + 'INDEX idx_active (is_active)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        await connection.query(
            'CREATE TABLE IF NOT EXISTS status_schedule_items ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'schedule_id INT NOT NULL,'
            + 'status_id INT NOT NULL,'
            + 'order_index INT DEFAULT 0,'
            + 'times_published INT DEFAULT 0,'
            + 'last_published_at DATETIME NULL,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'FOREIGN KEY (schedule_id) REFERENCES status_schedules(id) ON DELETE CASCADE,'
            + 'FOREIGN KEY (status_id) REFERENCES whatsapp_statuses(id) ON DELETE CASCADE,'
            + 'INDEX idx_schedule (schedule_id)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        await connection.query(
            'CREATE TABLE IF NOT EXISTS contact_statuses ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'session_id VARCHAR(50) NOT NULL,'
            + 'message_id VARCHAR(255) UNIQUE,'
            + 'contact_jid VARCHAR(255) NOT NULL,'
            + 'contact_name VARCHAR(255),'
            + 'avatar_url VARCHAR(1024),'
            + 'text_content TEXT,'
            + 'media_type ENUM(\'text\',\'image\',\'video\') DEFAULT \'text\','
            + 'media_url VARCHAR(1024),'
            + 'published_at DATETIME,'
            + 'expires_at DATETIME NULL,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'INDEX idx_session (session_id),'
            + 'INDEX idx_contact (contact_jid)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        console.log('[DB-TABLES] All tables ensured successfully.');

    } catch (error) {
        console.error('[DB-TABLES] Full error during createTables:', error);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

async function migrateTables(pool) {
    console.log('[DB-MIGRATION] Starting table migrations...');
    let connection;
    try {
        connection = await pool.getConnection();

        // Helper to add column if not exists
        const addColumnIfNotExists = async (tableName, columnName, columnDef) => {
            try {
                const [columns] = await connection.query(
                    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                     WHERE TABLE_SCHEMA = DATABASE()
                     AND TABLE_NAME = ?
                     AND COLUMN_NAME = ?`,
                    [tableName, columnName]
                );

                if (columns.length === 0) {
                    await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
                    console.log(`[DB-MIGRATION] ✓ Added column ${columnName} to ${tableName}`);
                }
            } catch (error) {
                if (error.code !== 'ER_DUP_FIELDNAME') {
                    console.error(`[DB-MIGRATION] Error adding column ${columnName} to ${tableName}:`, error.message);
                }
            }
        };

        // Migraciones secuenciales
        await addColumnIfNotExists('users', 'plan_id', 'INT NULL');
        await addColumnIfNotExists('users', 'is_blocked', 'BOOLEAN DEFAULT FALSE');
        await addColumnIfNotExists('users', 'last_seen', 'DATETIME');

        await addColumnIfNotExists('contact_groups', 'jid', 'VARCHAR(255)');
        await addColumnIfNotExists('contact_groups', 'session_id', 'VARCHAR(255)');
        await addColumnIfNotExists('contact_groups', 'description', 'TEXT');
        await addColumnIfNotExists('contact_groups', 'participants_count', 'INT DEFAULT 0');
        await addColumnIfNotExists('contact_groups', 'is_announcement', 'BOOLEAN DEFAULT FALSE');
        await addColumnIfNotExists('contact_groups', 'is_restricted', 'BOOLEAN DEFAULT FALSE');
        await addColumnIfNotExists('contact_groups', 'avatar_url', 'VARCHAR(1024)');

        await addColumnIfNotExists('messages', 'is_read', 'BOOLEAN DEFAULT FALSE');

        await addColumnIfNotExists('campaigns', 'phone', 'VARCHAR(255)');
        await addColumnIfNotExists('campaigns', 'message_media_url', 'VARCHAR(1024)');
        await addColumnIfNotExists('campaigns', 'message_media_type', 'VARCHAR(50)');
        await addColumnIfNotExists('campaigns', 'scheduled_at', 'DATETIME NULL');

        // Mapear índices únicos
        try {
            const [indexes] = await connection.query(
                `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
                 WHERE TABLE_SCHEMA = DATABASE()
                 AND TABLE_NAME = 'contact_groups'
                 AND INDEX_NAME = 'unique_group_per_session'`
            );

            if (indexes.length === 0) {
                try { await connection.query('ALTER TABLE contact_groups DROP INDEX name'); } catch (e) { }
                await connection.query('ALTER TABLE contact_groups ADD UNIQUE KEY unique_group_per_session (jid, session_id)');
            }
        } catch (e) { }

        console.log('[DB-MIGRATION] Migrations completed successfully.');
    } catch (error) {
        console.error('[DB-MIGRATION] Error during migration:', error);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

module.exports = {
    initializeDatabase
};
