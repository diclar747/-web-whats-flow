-- ============================================
-- ANALYTICS MODULE - DATABASE SCHEMA
-- ============================================
-- This schema creates optimized tables for analytics
-- with daily aggregation to improve query performance
-- ============================================

-- Table: analytics_message_metrics
-- Purpose: Daily aggregated message statistics
CREATE TABLE IF NOT EXISTS analytics_message_metrics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    metric_date DATE NOT NULL,
    
    -- Message counts
    total_sent INT DEFAULT 0,
    total_received INT DEFAULT 0,
    total_delivered INT DEFAULT 0,
    total_read INT DEFAULT 0,
    total_failed INT DEFAULT 0,
    total_pending INT DEFAULT 0,
    
    -- By channel
    whatsapp_count INT DEFAULT 0,
    sms_count INT DEFAULT 0,
    email_count INT DEFAULT 0,
    
    -- By type
    text_count INT DEFAULT 0,
    image_count INT DEFAULT 0,
    video_count INT DEFAULT 0,
    audio_count INT DEFAULT 0,
    document_count INT DEFAULT 0,
    
    -- Performance metrics
    avg_response_time_seconds INT DEFAULT 0,
    messages_per_hour DECIMAL(10,2) DEFAULT 0,
    
    -- Rates (stored as percentages)
    delivery_rate DECIMAL(5,2) DEFAULT 0,
    read_rate DECIMAL(5,2) DEFAULT 0,
    response_rate DECIMAL(5,2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_session_date (session_id, metric_date),
    INDEX idx_session_id (session_id),
    INDEX idx_metric_date (metric_date),
    INDEX idx_session_date (session_id, metric_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: analytics_campaign_metrics
-- Purpose: Campaign performance metrics
CREATE TABLE IF NOT EXISTS analytics_campaign_metrics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    campaign_id INT NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    
    -- Campaign info
    campaign_name VARCHAR(255),
    campaign_status VARCHAR(50),
    
    -- Recipient counts
    total_recipients INT DEFAULT 0,
    total_sent INT DEFAULT 0,
    total_delivered INT DEFAULT 0,
    total_read INT DEFAULT 0,
    total_failed INT DEFAULT 0,
    
    -- Performance
    delivery_rate DECIMAL(5,2) DEFAULT 0,
    read_rate DECIMAL(5,2) DEFAULT 0,
    effectiveness_score DECIMAL(5,2) DEFAULT 0,
    
    -- Timing
    scheduled_at DATETIME NULL,
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    duration_minutes INT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_campaign (campaign_id),
    INDEX idx_session_id (session_id),
    INDEX idx_campaign_status (campaign_status),
    INDEX idx_scheduled_at (scheduled_at),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: analytics_agent_metrics
-- Purpose: Daily agent performance metrics
CREATE TABLE IF NOT EXISTS analytics_agent_metrics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agent_id INT NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    metric_date DATE NOT NULL,
    
    -- Agent info
    agent_name VARCHAR(255),
    
    -- Activity metrics
    total_messages_sent INT DEFAULT 0,
    total_messages_received INT DEFAULT 0,
    total_conversations INT DEFAULT 0,
    conversations_closed INT DEFAULT 0,
    
    -- Time metrics (in minutes)
    connection_time_minutes INT DEFAULT 0,
    avg_response_time_seconds INT DEFAULT 0,
    
    -- Status distribution (in minutes)
    time_online_minutes INT DEFAULT 0,
    time_busy_minutes INT DEFAULT 0,
    time_away_minutes INT DEFAULT 0,
    
    -- Quality metrics
    quality_score DECIMAL(5,2) DEFAULT 0,
    customer_satisfaction DECIMAL(5,2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_agent_date (agent_id, metric_date),
    INDEX idx_session_id (session_id),
    INDEX idx_metric_date (metric_date),
    INDEX idx_agent_id (agent_id),
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: analytics_kanban_metrics
-- Purpose: Kanban board productivity metrics
CREATE TABLE IF NOT EXISTS analytics_kanban_metrics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    board_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    metric_date DATE NOT NULL,
    
    -- Board info
    board_name VARCHAR(255),
    
    -- Contact counts by stage
    contacts_new INT DEFAULT 0,
    contacts_in_progress INT DEFAULT 0,
    contacts_contacted INT DEFAULT 0,
    contacts_closed INT DEFAULT 0,
    contacts_lost INT DEFAULT 0,
    
    -- Movement metrics
    total_movements INT DEFAULT 0,
    contacts_converted INT DEFAULT 0,
    
    -- Time metrics (in hours)
    avg_time_new_hours DECIMAL(10,2) DEFAULT 0,
    avg_time_in_progress_hours DECIMAL(10,2) DEFAULT 0,
    avg_time_contacted_hours DECIMAL(10,2) DEFAULT 0,
    avg_time_to_close_hours DECIMAL(10,2) DEFAULT 0,
    
    -- Performance
    conversion_rate DECIMAL(5,2) DEFAULT 0,
    productivity_score DECIMAL(5,2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_board_date (board_id, metric_date),
    INDEX idx_session_id (session_id),
    INDEX idx_metric_date (metric_date),
    INDEX idx_board_id (board_id),
    FOREIGN KEY (board_id) REFERENCES kanban_boards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: analytics_system_alerts
-- Purpose: System alerts and notifications
CREATE TABLE IF NOT EXISTS analytics_system_alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    alert_type VARCHAR(50) NOT NULL, -- 'high_traffic', 'api_slow', 'error_spike', 'campaign_pending'
    severity VARCHAR(20) NOT NULL, -- 'info', 'warning', 'error', 'critical'
    title VARCHAR(255) NOT NULL,
    message TEXT,
    metric_value DECIMAL(10,2),
    threshold_value DECIMAL(10,2),
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_session_id (session_id),
    INDEX idx_alert_type (alert_type),
    INDEX idx_severity (severity),
    INDEX idx_is_resolved (is_resolved),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- INDEXES FOR EXISTING TABLES
-- ============================================
-- These indexes optimize analytics queries on existing tables

-- Messages table indexes for analytics
ALTER TABLE messages 
ADD INDEX IF NOT EXISTS idx_timestamp (timestamp),
ADD INDEX IF NOT EXISTS idx_session_timestamp (session_id, timestamp),
ADD INDEX IF NOT EXISTS idx_status (status),
ADD INDEX IF NOT EXISTS idx_message_type (message_type),
ADD INDEX IF NOT EXISTS idx_from_me (from_me);

-- Campaigns table indexes for analytics
ALTER TABLE campaigns
ADD INDEX IF NOT EXISTS idx_status (status),
ADD INDEX IF NOT EXISTS idx_session_status (session_id, status),
ADD INDEX IF NOT EXISTS idx_created_at (created_at),
ADD INDEX IF NOT EXISTS idx_scheduled_at (scheduled_at);

-- Campaign recipients indexes for analytics
ALTER TABLE campaign_recipients
ADD INDEX IF NOT EXISTS idx_status (status),
ADD INDEX IF NOT EXISTS idx_campaign_status (campaign_id, status),
ADD INDEX IF NOT EXISTS idx_sent_at (sent_at),
ADD INDEX IF NOT EXISTS idx_delivered_at (delivered_at),
ADD INDEX IF NOT EXISTS idx_read_at (read_at);

-- Agents table indexes for analytics
ALTER TABLE agents
ADD INDEX IF NOT EXISTS idx_status (status),
ADD INDEX IF NOT EXISTS idx_session_status (session_id, status),
ADD INDEX IF NOT EXISTS idx_last_activity (last_activity);

-- Kanban contacts indexes for analytics
ALTER TABLE kanban_contacts
ADD INDEX IF NOT EXISTS idx_board_id (board_id),
ADD INDEX IF NOT EXISTS idx_created_at (created_at),
ADD INDEX IF NOT EXISTS idx_updated_at (updated_at);

-- Chat assignments indexes for analytics
ALTER TABLE chat_assignments
ADD INDEX IF NOT EXISTS idx_status (status),
ADD INDEX IF NOT EXISTS idx_user_status (user_id, status),
ADD INDEX IF NOT EXISTS idx_assigned_at (assigned_at),
ADD INDEX IF NOT EXISTS idx_closed_at (closed_at);
