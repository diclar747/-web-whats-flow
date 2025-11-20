-- Tablas de Chatbot creadas
CREATE TABLE IF NOT EXISTS chatbot_flows (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    triggers JSON NOT NULL,
    response_type ENUM('text', 'image', 'video', 'audio', 'document') DEFAULT 'text',
    response_text TEXT,
    response_media VARCHAR(1024),
    kanban_board_id VARCHAR(255),
    active BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_session (session_id),
    KEY idx_active (active),
    KEY idx_priority (priority)
);

CREATE TABLE IF NOT EXISTS chatbot_interactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    flow_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    contact_jid VARCHAR(255) NOT NULL,
    trigger_matched VARCHAR(255),
    response_sent TEXT,
    interaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_flow (flow_id),
    KEY idx_session (session_id),
    KEY idx_contact (contact_jid),
    KEY idx_date (interaction_date),
    FOREIGN KEY (flow_id) REFERENCES chatbot_flows(id) ON DELETE CASCADE
);
