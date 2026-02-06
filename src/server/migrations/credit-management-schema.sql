-- ============================================
-- SISTEMA DE GESTIÓN DE CRÉDITOS - DATABASE SCHEMA
-- ============================================
-- Sistema completo para gestión de créditos con cuotas,
-- recordatorios automáticos y notificaciones WhatsApp
-- ============================================

-- Table: credits
-- Purpose: Almacena los créditos/cuentas por cobrar de los clientes
CREATE TABLE IF NOT EXISTS credits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    contact_id INT NOT NULL,
    contact_jid VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    
    -- Información del crédito
    total_amount DECIMAL(12, 2) NOT NULL, -- Monto total a pagar
    installment_count INT NOT NULL DEFAULT 1, -- Cantidad de cuotas
    installment_amount DECIMAL(12, 2) NOT NULL, -- Monto de cada cuota
    
    -- Fechas
    start_date DATE NOT NULL, -- Fecha de inicio del crédito
    due_day INT NOT NULL DEFAULT 5, -- Día de vencimiento de cada mes (1-31)
    
    -- Estado
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed', 'cancelled', 'defaulted'
    
    -- Configuración de recordatorios
    reminder_days_before INT DEFAULT 1, -- Días antes para enviar recordatorio (0=same day, 1, 2, 3)
    reminder_template_id VARCHAR(255), -- ID de plantilla personalizada
    
    -- Notas
    description TEXT,
    
    -- Metadata
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    
    INDEX idx_session_id (session_id),
    INDEX idx_contact_id (contact_id),
    INDEX idx_status (status),
    INDEX idx_session_status (session_id, status),
    INDEX idx_start_date (start_date),
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: credit_installments
-- Purpose: Almacena cada cuota individual del crédito
CREATE TABLE IF NOT EXISTS credit_installments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    credit_id INT NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    
    -- Información de la cuota
    installment_number INT NOT NULL, -- Número de cuota (1, 2, 3...)
    amount DECIMAL(12, 2) NOT NULL, -- Monto de esta cuota
    
    -- Fechas
    due_date DATE NOT NULL, -- Fecha de vencimiento
    paid_date DATE NULL, -- Fecha de pago (NULL si no está pagada)
    
    -- Estado
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'paid', 'overdue', 'cancelled'
    
    -- Recordatorios
    reminder_sent BOOLEAN DEFAULT FALSE, -- Si se envió el recordatorio
    reminder_sent_at TIMESTAMP NULL, -- Cuándo se envió
    reminder_count INT DEFAULT 0, -- Cuántos recordatorios se han enviado
    
    -- Notificaciones de vencimiento
    overdue_notification_sent BOOLEAN DEFAULT FALSE, -- Notificación de vencimiento enviada
    overdue_notification_sent_at TIMESTAMP NULL,
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_credit_id (credit_id),
    INDEX idx_session_id (session_id),
    INDEX idx_status (status),
    INDEX idx_due_date (due_date),
    INDEX idx_session_status (session_id, status),
    INDEX idx_reminder_check (status, due_date, reminder_sent), -- Para el job de recordatorios
    FOREIGN KEY (credit_id) REFERENCES credits(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: credit_reminder_logs
-- Purpose: Log de todos los recordatorios enviados
CREATE TABLE IF NOT EXISTS credit_reminder_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    installment_id INT NOT NULL,
    credit_id INT NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    contact_jid VARCHAR(255) NOT NULL,
    
    -- Información del envío
    reminder_type VARCHAR(50) NOT NULL, -- 'before_due', 'on_due', 'overdue'
    days_before INT DEFAULT 0, -- Cuántos días antes (0 si es el día)
    
    -- Contenido
    message_text TEXT NOT NULL,
    template_used VARCHAR(255),
    
    -- Estado del envío
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    whatsapp_message_id VARCHAR(255), -- ID del mensaje de WhatsApp
    status VARCHAR(50) DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed'
    error_message TEXT,
    
    INDEX idx_installment_id (installment_id),
    INDEX idx_credit_id (credit_id),
    INDEX idx_session_id (session_id),
    INDEX idx_sent_at (sent_at),
    INDEX idx_reminder_type (reminder_type),
    FOREIGN KEY (installment_id) REFERENCES credit_installments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: credit_templates
-- Purpose: Plantillas personalizadas para recordatorios de créditos
CREATE TABLE IF NOT EXISTS credit_templates (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    
    -- Información de la plantilla
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Contenido
    message_text TEXT NOT NULL,
    variables JSON, -- Variables disponibles: {nombre}, {monto}, {cuota_numero}, {total_cuotas}, {fecha_vencimiento}, {credito_descripcion}
    
    -- Configuración
    reminder_type VARCHAR(50) DEFAULT 'before_due', -- 'before_due', 'on_due', 'overdue'
    days_before INT DEFAULT 1, -- Para tipo 'before_due'
    
    -- Estado
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_session_id (session_id),
    INDEX idx_is_active (is_active),
    INDEX idx_reminder_type (reminder_type),
    INDEX idx_session_default (session_id, is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar plantillas predeterminadas
INSERT INTO credit_templates (id, session_id, name, description, message_text, variables, reminder_type, days_before, is_default, is_active) VALUES
-- Recordatorio antes del vencimiento
(UUID(), 'default', 'Recordatorio Amigable', 'Recordatorio cordial antes del vencimiento', 
'¡Hola {nombre}! 👋

Esperamos que tengas un excelente día. 🌟

Te recordamos amablemente que tienes una cuota pendiente:

💰 *Monto:* Gs. {monto}
📊 *Cuota:* {cuota_numero} de {total_cuotas}
📅 *Vencimiento:* {fecha_vencimiento}

Si ya realizaste el pago, por favor ignora este mensaje. 🙏

¡Gracias por tu preferencia! 😊',
'["nombre", "monto", "cuota_numero", "total_cuotas", "fecha_vencimiento"]', 
'before_due', 2, TRUE, TRUE),

-- Recordatorio el día del vencimiento
(UUID(), 'default', 'Recordatorio del Día de Pago', 'Recordatorio el día del vencimiento',
'¡Buen día {nombre}! 📅

Hoy es el día de vencimiento de tu cuota:

💰 *Monto a pagar:* Gs. {monto}
📊 *Cuota:* {cuota_numero} de {total_cuotas}

Por favor, realiza tu pago hoy para evitar recargos.

¿Necesitas ayuda? Contáctanos. 📞',
'["nombre", "monto", "cuota_numero", "total_cuotas"]',
'on_due', 0, TRUE, TRUE),

-- Recordatorio de cuota vencida
(UUID(), 'default', 'Aviso de Cuota Vencida', 'Notificación cuando la cuota está vencida',
'⚠️ *AVISO IMPORTANTE* ⚠️

Estimado/a {nombre},

Le informamos que su cuota número {cuota_numero} de {total_cuotas} ha vencido.

💰 *Monto pendiente:* Gs. {monto}
📅 *Fecha de vencimiento:* {fecha_vencimiento}

Le solicitamos regularizar su situación a la brevedad posible para evitar inconvenientes.

Para coordinar su pago, por favor contáctenos. 📞',
'["nombre", "monto", "cuota_numero", "total_cuotas", "fecha_vencimiento"]',
'overdue', 0, TRUE, TRUE),

-- Recordatorio formal
(UUID(), 'default', 'Recordatorio Formal', 'Estilo más formal para recordatorios',
'Estimado/a {nombre},

Por medio de este mensaje le recordamos su compromiso de pago pendiente:

📋 *Concepto:* Cuota {cuota_numero}/{total_cuotas}
💰 *Importe:* Gs. {monto}
📅 *Vencimiento:* {fecha_vencimiento}

Agradecemos su puntualidad en los pagos.

Atentamente,
Equipo de Gestión 💼',
'["nombre", "monto", "cuota_numero", "total_cuotas", "fecha_vencimiento"]',
'before_due', 3, FALSE, TRUE);

-- ============================================
-- VIEWS PARA CONSULTAS COMUNES
-- ============================================

-- View: credit_summary
-- Resumen de créditos con estadísticas
CREATE OR REPLACE VIEW credit_summary AS
SELECT 
    c.id,
    c.session_id,
    c.contact_id,
    c.contact_name,
    c.total_amount,
    c.installment_count,
    c.installment_amount,
    c.start_date,
    c.due_day,
    c.status as credit_status,
    c.description,
    
    -- Estadísticas de cuotas
    (SELECT COUNT(*) FROM credit_installments ci WHERE ci.credit_id = c.id) as total_installments,
    (SELECT COUNT(*) FROM credit_installments ci WHERE ci.credit_id = c.id AND ci.status = 'paid') as paid_installments,
    (SELECT COUNT(*) FROM credit_installments ci WHERE ci.credit_id = c.id AND ci.status = 'pending') as pending_installments,
    (SELECT COUNT(*) FROM credit_installments ci WHERE ci.credit_id = c.id AND ci.status = 'overdue') as overdue_installments,
    
    -- Próxima cuota
    (SELECT MIN(ci.due_date) FROM credit_installments ci WHERE ci.credit_id = c.id AND ci.status = 'pending') as next_due_date,
    (SELECT ci.amount FROM credit_installments ci WHERE ci.credit_id = c.id AND ci.status = 'pending' ORDER BY ci.due_date LIMIT 1) as next_due_amount,
    
    -- Totales pagados
    (SELECT COALESCE(SUM(ci.amount), 0) FROM credit_installments ci WHERE ci.credit_id = c.id AND ci.status = 'paid') as total_paid,
    (SELECT COALESCE(SUM(ci.amount), 0) FROM credit_installments ci WHERE ci.credit_id = c.id AND ci.status = 'pending') as total_pending,
    
    c.created_at,
    c.updated_at
FROM credits c;

-- View: installments_due_soon
-- Cuotas que vencen en los próximos días
CREATE OR REPLACE VIEW installments_due_soon AS
SELECT 
    ci.*,
    c.contact_name,
    c.contact_jid,
    c.reminder_days_before,
    c.reminder_template_id,
    DATEDIFF(ci.due_date, CURDATE()) as days_until_due
FROM credit_installments ci
JOIN credits c ON ci.credit_id = c.id
WHERE ci.status = 'pending'
    AND c.status = 'active'
    AND ci.due_date >= CURDATE()
    AND ci.reminder_sent = FALSE;

-- View: installments_overdue
-- Cuotas vencidas
CREATE OR REPLACE VIEW installments_overdue AS
SELECT 
    ci.*,
    c.contact_name,
    c.contact_jid,
    c.reminder_template_id,
    DATEDIFF(CURDATE(), ci.due_date) as days_overdue
FROM credit_installments ci
JOIN credits c ON ci.credit_id = c.id
WHERE ci.status = 'overdue'
    AND c.status = 'active';
