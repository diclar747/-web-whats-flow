-- Script simple para agregar columna category a contacts
-- Ejecutar en MySQL Workbench o línea de comandos

USE whatsflow;

-- Agregar columna category si no existe
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS category VARCHAR(255) DEFAULT 'sin_categoria' AFTER is_online;

-- Agregar índice
ALTER TABLE contacts
ADD INDEX IF NOT EXISTS idx_category (category);

-- Verificar que se agregó correctamente
SHOW COLUMNS FROM contacts LIKE 'category';

-- Ver contactos actuales
SELECT COUNT(*) as total, category FROM contacts GROUP BY category;
