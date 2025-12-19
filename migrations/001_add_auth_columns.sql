-- Migración 1: Agregar columnas de autenticación a user_sessions
ALTER TABLE user_sessions 
ADD COLUMN full_name VARCHAR(255) DEFAULT NULL AFTER phone_number,
ADD COLUMN email VARCHAR(255) DEFAULT NULL,
ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL,
ADD COLUMN last_login TIMESTAMP NULL,
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Crear índice único en email (permitir NULL para usuarios existentes)
CREATE UNIQUE INDEX idx_email ON user_sessions(email);

-- Actualizar usuarios existentes con valores temporales
UPDATE user_sessions 
SET 
  full_name = CONCAT('Usuario ', phone_number),
  email = CONCAT(phone_number, '@temp.whatsflow.com'),
  password_hash = '$2b$10$temporary.hash.for.existing.users'
WHERE email IS NULL;

-- Ahora hacer las columnas NOT NULL
ALTER TABLE user_sessions 
MODIFY COLUMN email VARCHAR(255) NOT NULL,
MODIFY COLUMN password_hash VARCHAR(255) NOT NULL;
