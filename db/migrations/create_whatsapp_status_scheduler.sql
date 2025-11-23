-- =====================================================
-- Migración: Sistema de Estados de WhatsApp Programados
-- Fecha: 2025-11-23
-- Descripción: Crea tablas para gestionar estados de WhatsApp
--              con programación automática y rotación de 30 días
-- =====================================================

-- Tabla principal de estados de WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_statuses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL COMMENT 'ID de la sesión de WhatsApp',
  text_content TEXT COMMENT 'Contenido de texto del estado',
  media_url VARCHAR(500) COMMENT 'URL del archivo multimedia (imagen/video)',
  media_type ENUM('image', 'video', 'text') DEFAULT 'text' COMMENT 'Tipo de contenido',
  background_color VARCHAR(20) DEFAULT '#075E54' COMMENT 'Color de fondo para estados de texto',
  font_style VARCHAR(50) DEFAULT 'default' COMMENT 'Estilo de fuente',
  status ENUM('draft', 'scheduled', 'published', 'failed', 'expired') DEFAULT 'draft' COMMENT 'Estado actual',
  scheduled_at DATETIME COMMENT 'Fecha programada para publicación',
  published_at DATETIME COMMENT 'Fecha real de publicación',
  expires_at DATETIME COMMENT 'Fecha de expiración (24h después de publicar)',
  views_count INT DEFAULT 0 COMMENT 'Número de visualizaciones',
  error_message TEXT COMMENT 'Mensaje de error si falló la publicación',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_session (session_id),
  INDEX idx_status (status),
  INDEX idx_scheduled (scheduled_at),
  INDEX idx_published (published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Estados de WhatsApp individuales';

-- Tabla de programaciones de estados (schedules)
CREATE TABLE IF NOT EXISTS status_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL COMMENT 'ID de la sesión de WhatsApp',
  name VARCHAR(255) NOT NULL COMMENT 'Nombre descriptivo de la programación',
  interval_minutes INT NOT NULL DEFAULT 60 COMMENT 'Intervalo entre publicaciones en minutos',
  rotation_days INT DEFAULT 30 COMMENT 'Días de rotación antes de reiniciar',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Si la programación está activa',
  last_published_at DATETIME COMMENT 'Última vez que se publicó un estado',
  next_publish_at DATETIME COMMENT 'Próxima publicación programada',
  current_index INT DEFAULT 0 COMMENT 'Índice del estado actual en la rotación',
  total_published INT DEFAULT 0 COMMENT 'Total de estados publicados',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_session (session_id),
  INDEX idx_active (is_active),
  INDEX idx_next_publish (next_publish_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Programaciones de estados automáticos';

-- Tabla de relación entre schedules y estados
CREATE TABLE IF NOT EXISTS status_schedule_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schedule_id INT NOT NULL COMMENT 'ID de la programación',
  status_id INT NOT NULL COMMENT 'ID del estado',
  order_index INT NOT NULL COMMENT 'Orden en la secuencia de publicación',
  times_published INT DEFAULT 0 COMMENT 'Veces que se ha publicado este estado',
  last_published_at DATETIME COMMENT 'Última publicación de este estado específico',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (schedule_id) REFERENCES status_schedules(id) ON DELETE CASCADE,
  FOREIGN KEY (status_id) REFERENCES whatsapp_statuses(id) ON DELETE CASCADE,
  INDEX idx_schedule (schedule_id),
  INDEX idx_status (status_id),
  INDEX idx_order (schedule_id, order_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Relación entre programaciones y estados';

-- Tabla de estadísticas de estados
CREATE TABLE IF NOT EXISTS status_analytics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  status_id INT NOT NULL COMMENT 'ID del estado',
  session_id VARCHAR(255) NOT NULL COMMENT 'ID de la sesión',
  views INT DEFAULT 0 COMMENT 'Visualizaciones',
  replies INT DEFAULT 0 COMMENT 'Respuestas recibidas',
  shares INT DEFAULT 0 COMMENT 'Veces compartido',
  date DATE NOT NULL COMMENT 'Fecha de las estadísticas',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (status_id) REFERENCES whatsapp_statuses(id) ON DELETE CASCADE,
  INDEX idx_status (status_id),
  INDEX idx_session (session_id),
  INDEX idx_date (date),
  UNIQUE KEY unique_status_date (status_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Estadísticas diarias de estados';

-- Insertar datos de ejemplo para testing (opcional)
-- NOTA: Comentado por defecto, descomentar solo para desarrollo/testing
/*
INSERT INTO whatsapp_statuses (session_id, text_content, media_type, status) VALUES
('test_session', '¡Hola! Este es un estado de prueba 👋', 'text', 'draft'),
('test_session', '¡Ofertas especiales hoy! 🎉', 'text', 'draft'),
('test_session', 'Nuevo producto disponible 🚀', 'text', 'draft');

INSERT INTO status_schedules (session_id, name, interval_minutes, rotation_days, is_active) VALUES
('test_session', 'Programación de Prueba', 60, 30, TRUE);

INSERT INTO status_schedule_items (schedule_id, status_id, order_index) VALUES
(1, 1, 0),
(1, 2, 1),
(1, 3, 2);
*/

-- Verificar que las tablas se crearon correctamente
SELECT 
  TABLE_NAME, 
  TABLE_ROWS, 
  CREATE_TIME 
FROM 
  information_schema.TABLES 
WHERE 
  TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME IN ('whatsapp_statuses', 'status_schedules', 'status_schedule_items', 'status_analytics')
ORDER BY 
  TABLE_NAME;
